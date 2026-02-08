import { useState, useEffect, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';

interface CountdownTimerProps {
  voteEndAt: Timestamp | null | undefined;
  status: 'OPEN' | 'CLOSED';
}

const CountdownTimer = ({ voteEndAt, status }: CountdownTimerProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!voteEndAt || status === 'CLOSED') return;

    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      
      // 마감 시간이 지나면 타이머 정지
      if (currentNow >= voteEndAt.toMillis()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [voteEndAt, status]);

  const timeRemaining = useMemo(() => {
    if (!voteEndAt || status === 'CLOSED') return null;
    
    const endTime = voteEndAt.toMillis();
    const remaining = endTime - now;

    if (remaining <= 0) return null;

    return {
      days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
      hours: Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((remaining % (1000 * 60)) / 1000)
    };
  }, [voteEndAt, status, now]);

  if (!timeRemaining) return null;

  return (
    <div style={{ position: 'absolute', bottom: '-25px', right: '0', fontSize: '13px', color: '#9E9E9E' }}>
      남은 재판 시간 {timeRemaining.days > 0 ? `${timeRemaining.days}일 ` : ''}
      {String(timeRemaining.hours).padStart(2, '0')} : {String(timeRemaining.minutes).padStart(2, '0')} : {String(timeRemaining.seconds).padStart(2, '0')}
    </div>
  );
};

export default CountdownTimer;
