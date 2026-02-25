import React, { useState, useEffect, useRef } from 'react';
import { Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';

interface ReportBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
}

const ReportBottomSheet: React.FC<ReportBottomSheetProps> = ({ isOpen, onClose, onSubmit }) => {
    const [reason, setReason] = useState('');
    const bottomSheetRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);



    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // 사용자가 입력창을 클릭할 때 키보드가 올라오도록 자동 포커스 제거
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // 바텀 시트 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bottomSheetRef.current && !bottomSheetRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* 백그라운드 오버레이 */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />

            {/* 모달 내용 (화면 중앙 배열) */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center', // 중앙 정렬 추가
                    justifyContent: 'center',
                    padding: '24px', // 여백 추가
                    pointerEvents: 'none', // 클릭 이벤트 통과
                }}
            >
                <div
                    ref={bottomSheetRef}
                    style={{
                        width: '100%',
                        maxWidth: '400px', // 다이얼로그 너비
                        backgroundColor: 'white',
                        borderRadius: '24px', // 모든 테두리 둥글게
                        padding: '24px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                        animation: 'zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        pointerEvents: 'auto', // 내부 클릭 허용
                        boxSizing: 'border-box'
                    }}
                >
                    {/* 상단 라인 마크 제거: 중앙 모달에는 불필요 */}

                    <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                        <Text display="block" color={adaptive.grey800 || "#333D4B"} typography="t4" fontWeight="bold" style={{ marginBottom: '8px' }}>
                            신고하시겠습니까?
                        </Text>
                        <Text display="block" color={adaptive.grey600 || "#6B7684"} typography="t6">
                            커뮤니티 운영을 위해 사유를 입력해 주세요
                        </Text>
                    </div>

                    <textarea
                        ref={inputRef}
                        inputMode="text" // iOS에서 완료 버튼이 있는 Number Pad 툴바가 뜨는 것을 방지
                        value={reason}
                        onChange={(e) => {
                            if (e.target.value.length <= 100) {
                                setReason(e.target.value);
                            }
                        }}
                        placeholder="사유 입력"
                        style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '12px 0 12px 0',
                            border: 'none',
                            borderBottom: '1px solid #E5E8EB', // variant="line" 스타일
                            borderRadius: '0',
                            fontSize: '16px',
                            lineHeight: '1.5',
                            resize: 'none',
                            outline: 'none',
                            boxSizing: 'border-box',
                            marginBottom: '4px',
                            backgroundColor: 'white',
                            color: '#191F28'
                        }}
                    />
                    <div style={{ textAlign: 'right', marginBottom: '32px' }}>
                        <Text color={reason.length >= 100 ? '#D32F2F' : '#8B95A1'} typography="st13">
                            {reason.length}/100
                        </Text>
                    </div>

                    {/* CTA 버튼 */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '16px',
                                backgroundColor: '#F2F4F6',
                                color: '#4E5968',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                            }}
                        >
                            닫기
                        </button>
                        <button
                            onClick={() => {
                                if (reason.trim()) {
                                    onSubmit(reason.trim());
                                    onClose();
                                } else {
                                    alert('신고 사유를 입력해주세요.');
                                    inputRef.current?.focus();
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '16px',
                                backgroundColor: '#3182F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                opacity: reason.trim() ? 1 : 0.5,
                            }}
                        >
                            신고하기
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
        </>
    );
};

export default ReportBottomSheet;
