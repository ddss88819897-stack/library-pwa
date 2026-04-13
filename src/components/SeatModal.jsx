import React, { useState, useEffect } from 'react';
// 🔥 [수정됨] DB 저장을 위한 파이어베이스 도구들 불러오기
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function SeatModal({
  selectedSeat, setSelectedSeat, user, handleAction
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  useEffect(() => {
    setStartTime(null); setEndTime(null);
  }, [selectedDate]);

  if (!selectedSeat) return null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const calendarDays = Array(firstDay).fill(null).concat(
    [...Array(daysInMonth).keys()].map(i => new Date(year, month, i + 1))
  );

  const timeSlots = [];
  for (let h = 9; h <= 22; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 22) timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  const isSameDate = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const isPastDate = (date) => { const today = new Date(); today.setHours(0, 0, 0, 0); return date < today; };
  const isTimeBefore = (time1, time2) => {
    if (!time1 || !time2) return false;
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return h1 * 60 + m1 < h2 * 60 + m2;
  };

  const handleInitialClick = () => {
    if (!startTime || !endTime) return alert("🚨 시작 시간과 종료 시간을 모두 선택해주세요!");
    if (!isTimeBefore(startTime, endTime)) return alert("🚨 종료 시간은 시작 시간보다 늦어야 합니다!");
    setShowConfirmPopup(true);
  };

  // 🔥 [핵심 수정!] 팝업에서 [예, 확정합니다] 클릭 시 진짜 파이어베이스에 저장!
  const handleFinalReserve = async () => {
    try {
      const formattedDate = `${year}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

      // 1️⃣ 마이페이지용 예약 데이터 저장
      await addDoc(collection(db, "Reservations"), {
        seatId: selectedSeat.id,
        userId: user.email,
        date: formattedDate,
        startTime: startTime,
        endTime: endTime,
        status: 'RESERVED',
        createdAt: serverTimestamp()
      });

      // 2️⃣ 알림(🔔)을 울리게 하는 로그 데이터 저장!
      await addDoc(collection(db, "Log"), {
        action: 'RESERVE',
        seatId: selectedSeat.id,
        seatLabel: selectedSeat.id,
        uid: user.email,
        result: '시간 지정 예약 완료',
        createdAt: serverTimestamp()
      });

      alert(`🎉 예약이 완료되었습니다!\n[${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${startTime} ~ ${endTime}]\n\n예약 내역은 마이페이지에서 확인 가능합니다.`);
      setShowConfirmPopup(false);
      setSelectedSeat(null);
    } catch (error) {
      console.error("DB 저장 에러:", error);
      alert("🚨 예약 처리 중 문제가 발생했습니다.");
    }
  };

  return (
    <>
      {showConfirmPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', padding: '35px 25px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.4rem', color: '#0f172a', fontWeight: '900' }}>예약을 확정하시겠습니까?</h3>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '25px', color: '#334155', fontWeight: '700', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>📌 <strong style={{color: '#0f172a'}}>{selectedSeat.id}</strong> 좌석</p>
              <p style={{ margin: '0 0 8px 0' }}>📅 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</p>
              <p style={{ margin: 0, color: '#2563eb', fontSize: '1.2rem', fontWeight: '900' }}>⏰ {startTime} ~ {endTime}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirmPopup(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', transition: '0.2s' }}>아니오</button>
              <button onClick={handleFinalReserve} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)', transition: '0.2s' }}>예, 확정합니다!</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999, padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '550px', backgroundColor: '#fff', borderRadius: '24px', padding: '30px', boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>{selectedSeat.id} 예약</h2>
            <button onClick={() => setSelectedSeat(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>◀</button>
              <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{year}년 {month + 1}월</strong>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>▶</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '900', color: '#94a3b8' }}>
              <div style={{color: '#ef4444'}}>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style={{color: '#3b82f6'}}>토</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={idx} />;
                const isPast = isPastDate(date);
                const isSelected = isSameDate(date, selectedDate);
                const isToday = isSameDate(date, new Date());
                return (
                  <div 
                    key={idx} onClick={() => !isPast && setSelectedDate(date)}
                    style={{ 
                      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '700', transition: 'all 0.2s', cursor: isPast ? 'not-allowed' : 'pointer', opacity: isPast ? 0.3 : 1, background: isSelected ? '#2563eb' : (isToday ? '#dbeafe' : 'transparent'), color: isSelected ? '#fff' : (isToday ? '#1d4ed8' : '#334155'), border: isToday && !isSelected ? '2px solid #bfdbfe' : 'none'
                    }}
                  >{date.getDate()}</div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>시작 시간</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
                {timeSlots.map(time => {
                  const isSelected = startTime === time;
                  return (
                    <button 
                      key={`start-${time}`} onClick={() => { setStartTime(time); if(endTime && !isTimeBefore(time, endTime)) setEndTime(null); }}
                      style={{ padding: '10px 0', borderRadius: '10px', border: `1px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`, background: isSelected ? '#eff6ff' : '#fff', color: isSelected ? '#2563eb' : '#475569', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s' }}
                    >{time}</button>
                  )
                })}
              </div>
            </div>
            <div style={{ opacity: startTime ? 1 : 0.4, transition: '0.3s' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px' }}>종료 시간</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
                {timeSlots.map(time => {
                  const isSelected = endTime === time;
                  const isDisabled = !startTime || !isTimeBefore(startTime, time);
                  return (
                    <button 
                      key={`end-${time}`} disabled={isDisabled} onClick={() => setEndTime(time)}
                      style={{ padding: '10px 0', borderRadius: '10px', border: `1px solid ${isSelected ? '#16a34a' : '#cbd5e1'}`, background: isSelected ? '#f0fdf4' : (isDisabled ? '#f1f5f9' : '#fff'), color: isSelected ? '#16a34a' : (isDisabled ? '#94a3b8' : '#475569'), fontWeight: '800', fontSize: '0.9rem', cursor: isDisabled ? 'not-allowed' : 'pointer', transition: '0.2s' }}
                    >{time}</button>
                  )
                })}
              </div>
            </div>
          </div>

          <button 
            onClick={handleInitialClick} 
            style={{ width: '100%', padding: '18px', marginTop: '30px', background: (startTime && endTime) ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '1.1rem', cursor: (startTime && endTime) ? 'pointer' : 'not-allowed', transition: '0.3s', boxShadow: (startTime && endTime) ? '0 4px 15px rgba(37, 99, 235, 0.3)' : 'none' }}
          >
            예약 확정하기
          </button>

        </div>
      </div>
    </>
  );
}