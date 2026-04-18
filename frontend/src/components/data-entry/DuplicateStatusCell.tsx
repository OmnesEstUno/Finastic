export type DuplicateStatus = 'unique' | 'pending' | 'approved' | 'denied';

interface DuplicateStatusCellProps {
  status: DuplicateStatus;
  onApprove: () => void;
  onDeny: () => void;
  onRevert: () => void;
}

export default function DuplicateStatusCell({ status, onApprove, onDeny, onRevert }: DuplicateStatusCellProps) {
  if (status === 'unique') {
    return <span className="text-xs text-muted">—</span>;
  }

  const chipStyles: Record<Exclude<DuplicateStatus, 'unique'>, React.CSSProperties> = {
    pending: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)',
      border: '1px solid rgba(251,191,36,0.25)',
    },
    approved: {
      background: 'var(--success-bg)',
      color: 'var(--success)',
      border: '1px solid rgba(74,222,128,0.25)',
    },
    denied: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid rgba(248,113,113,0.25)',
    },
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span className="chip" style={chipStyles[status as Exclude<DuplicateStatus, 'unique'>]}>
        {status === 'pending' ? 'Duplicate?' : status === 'approved' ? 'Approved' : 'Denied'}
      </span>
      {status === 'pending' && (
        <>
          <button
            className="btn btn-sm"
            style={{
              padding: '3px 8px',
              fontSize: '0.7rem',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              border: '1px solid rgba(74,222,128,0.3)',
            }}
            onClick={onApprove}
            title="Approve — import this row anyway"
          >
            Approve
          </button>
          <button
            className="btn btn-sm"
            style={{
              padding: '3px 8px',
              fontSize: '0.7rem',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid rgba(248,113,113,0.3)',
            }}
            onClick={onDeny}
            title="Deny — skip this row"
          >
            Deny
          </button>
        </>
      )}
      {(status === 'approved' || status === 'denied') && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '3px 8px', fontSize: '0.7rem' }}
          onClick={onRevert}
          title="Undo — return to pending"
        >
          Undo
        </button>
      )}
    </div>
  );
}
