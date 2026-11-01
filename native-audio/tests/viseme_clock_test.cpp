#include "NiaVisemeClock.hpp"
#include <cassert>
#include <thread>
#include <atomic>
int main() {
 nia::VisemeRing<4> q;
 assert(!q.push({0,0,1,1.f}));
 assert(!q.push({0,10,1,1.1f}));
 assert(q.push({0,100,1,0.8f}));
 assert(q.push({100,200,2,0.5f}));
 assert(q.push({200,300,3,0.5f}));
 assert(!q.push({300,400,4,0.5f}));
 nia::VisemeEvent event{};
 assert(q.pop(event) && event.shape==1);
 assert(q.pop(event) && event.shape==2);
 assert(q.pop(event) && event.shape==3);
 assert(!q.pop(event));
 nia::PlaybackClock clock;
 assert(clock.frameAt(1000000000LL)==-1);
 clock.update(48000,1000000000LL,48000);
 assert(clock.frameAt(1010000000LL)==48480);
 std::atomic<bool> running{true};
 std::thread writer([&] {for(int i=0;i<100000;i++) clock.update(48000+i,1000000000LL+i*1000000LL,48000);running=false;});
 while(running.load()) {auto frame=clock.frameAt(1010000000LL);assert(frame==-1||frame>=0);}
 writer.join();
}
