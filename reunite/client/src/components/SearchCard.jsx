// One search and its outcome. Only agreed matches are ever shown, so
// "still looking" covers both "nobody yet" and "they said no".
export default function SearchCard({ search, onClose, busy, who = 'you' }) {
  const open = search.status === 'open';
  const found = search.found.length > 0;

  return (
    <li className="candidate stack">
      <div>
        <span className="person-name">{search.names.join(', ')}</span>
        {search.relationship && <div className="person-meta">{search.relationship}</div>}
      </div>

      {found && search.found.map((f) => (
        <div key={f.name} className="notice success">
          {f.shelterName ? (
            <>
              <strong>{f.name} wants to connect.</strong> They're at {f.shelterName}
              {f.shelterAddress ? `, ${f.shelterAddress}` : ''}.{' '}
              {who === 'you'
                ? 'Go to the front desk and tell them who you\'re looking for.'
                : 'Call that shelter\'s desk, or help them get there.'}
            </>
          ) : (
            <><strong>{f.name} wants to connect</strong> but has since left the shelters. Ask at any shelter's front desk.</>
          )}
        </div>
      ))}
      {!found && open && (
        <p className="muted" style={{ margin: 0 }}>
          Still looking. We check again every time someone new is registered at a shelter.
        </p>
      )}
      {!open && <p className="muted" style={{ margin: 0 }}>Closed.</p>}

      {open && onClose && (
        <button className="btn btn-quiet btn-block" disabled={busy} onClick={() => onClose(search)}>
          {found ? 'We\'ve found each other. Close this search' : 'Stop searching'}
        </button>
      )}
    </li>
  );
}
