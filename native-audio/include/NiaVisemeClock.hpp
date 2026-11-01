#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cstdint>
#include <cmath>

namespace nia {
// Single-producer/single-consumer bounded queue. Both threads must use their own
// queue role exclusively; no allocations or locks occur on the audio thread.
struct VisemeEvent {
  int64_t startFrame;
  int64_t endFrame;
  uint8_t shape;
  float weight;
};
template <size_t Capacity> class VisemeRing {
  static_assert(Capacity >= 2, "capacity must be >= 2");
  std::array<VisemeEvent, Capacity> data_{};
  std::atomic<size_t> read_{0}, write_{0};
public:
  bool push(const VisemeEvent& event) noexcept {
    if(event.endFrame <= event.startFrame || event.weight < 0.f ||
       event.weight > 1.f || !std::isfinite(event.weight)) return false;
    const auto w=write_.load(std::memory_order_relaxed);
    const auto next=(w+1)%Capacity;
    if(next==read_.load(std::memory_order_acquire)) return false;
    data_[w]=event;
    write_.store(next,std::memory_order_release);
    return true;
  }
  bool pop(VisemeEvent& out) noexcept {
    const auto r=read_.load(std::memory_order_relaxed);
    if(r==write_.load(std::memory_order_acquire)) return false;
    out=data_[r];
    read_.store((r+1)%Capacity,std::memory_order_release);
    return true;
  }
};

// Anchor to the *measured audio playback head*, never the wall clock or
// a guessed TTS start time. Android AudioTrack timestamps can supply the anchor.
class PlaybackClock {
  // Seqlock: one writer publishes frame, timestamp and sample rate atomically
  // as a coherent snapshot to any number of readers.
  std::atomic<uint64_t> sequence_{0};
  std::atomic<int64_t> frame_{0};
  std::atomic<int64_t> timestampNs_{0};
  std::atomic<int32_t> sampleRate_{48000};
public:
  // Exactly one thread may call update().
  void update(int64_t playbackFrame, int64_t monotonicNs, int32_t sampleRate) noexcept {
    if(sampleRate<=0 || monotonicNs<=0 || playbackFrame<0) return;
    sequence_.fetch_add(1,std::memory_order_acq_rel);
    frame_.store(playbackFrame,std::memory_order_relaxed);
    timestampNs_.store(monotonicNs,std::memory_order_relaxed);
    sampleRate_.store(sampleRate,std::memory_order_relaxed);
    sequence_.fetch_add(1,std::memory_order_release);
  }
  int64_t frameAt(int64_t monotonicNs) const noexcept {
    int64_t base=0,anchorNs=0;
    int32_t rate=0;
    for(int attempt=0;attempt<8;++attempt) {
      const auto before=sequence_.load(std::memory_order_acquire);
      if(before&1U) continue;
      base=frame_.load(std::memory_order_relaxed);
      anchorNs=timestampNs_.load(std::memory_order_relaxed);
      rate=sampleRate_.load(std::memory_order_relaxed);
      const auto after=sequence_.load(std::memory_order_acquire);
      if(before==after) {
        if(anchorNs<=0 || rate<=0) return -1;
        const auto delta=std::clamp(monotonicNs-anchorNs,int64_t(-50000000),int64_t(50000000));
        return std::max<int64_t>(0,base+delta*rate/1000000000LL);
      }
    }
    return -1; // Busy writer: fail closed rather than use a torn timestamp.
  }
};
} // namespace nia
