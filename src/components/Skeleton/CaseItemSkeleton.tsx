

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {/* 제목 스켈레톤 */}
                <SkeletonItem width="100%" height="24px" borderRadius="6px" />
            </div>

            {/* 본문 두 줄 스켈레톤 */}
            <SkeletonItem width="100%" height="20px" borderRadius="4px" style={{ marginBottom: '6px' }} />
            <SkeletonItem width="80%" height="20px" borderRadius="4px" style={{ marginBottom: '12px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 조회수/댓글 아이콘 대체 영역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <SkeletonItem width="15px" height="15px" borderRadius="50%" />
                    <SkeletonItem width="24px" height="14px" borderRadius="4px" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <SkeletonItem width="15px" height="15px" borderRadius="50%" />
                    <SkeletonItem width="24px" height="14px" borderRadius="4px" />
                </div>
            </div>
        </div>
    );
};
