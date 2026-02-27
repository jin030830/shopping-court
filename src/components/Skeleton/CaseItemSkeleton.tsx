

const SkeletonPulse = () => (
    <style>{`
    @keyframes pulse-skeleton {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
  `}</style>
);

const SkeletonItem = ({ width, height, borderRadius = '4px', style = {} }: any) => (
    <div
        style={{
            width,
            height,
            borderRadius,
            backgroundColor: '#E5E8EB',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            ...style,
        }}
    />
);

export const CaseItemSkeleton = () => {
    return (
        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <SkeletonPulse />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                {/* 제목 및 상대 시간 스켈레톤 */}
                <SkeletonItem width="100%" height="24px" borderRadius="6px" style={{ flex: 1 }} />
                <SkeletonItem width="50px" height="16px" borderRadius="4px" style={{ flexShrink: 0, marginTop: '4px' }} />
            </div>

            {/* 본문 두 줄 스켈레톤 */}
            <SkeletonItem width="100%" height="20px" borderRadius="4px" style={{ marginBottom: '6px' }} />
            <SkeletonItem width="80%" height="20px" borderRadius="4px" style={{ marginBottom: '12px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* 조회수 스켈레톤 */}
                <SkeletonItem width="60px" height="15px" borderRadius="4px" />

                {/* 아바타/댓글 카운트 스켈레톤 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <SkeletonItem width="14px" height="14px" borderRadius="50%" />
                    <SkeletonItem width="20px" height="15px" borderRadius="4px" />
                </div>
            </div>
        </div>
    );
};
