import { useState } from 'react';

// "Who are you looking for?" Shared by public users and by volunteers
// filing for someone with no phone (who = 'them').
export default function SearchForm({ who = 'you', submitLabel = 'Start searching', busy, error, onSubmit, onCancel }) {
  const [names, setNames] = useState(['']);
  const [v, setV] = useState({ relationship: '', ageMin: '', ageMax: '', homeArea: '', description: '' });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });
  const setName = (i) => (e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)));

  function submit(e) {
    e.preventDefault();
    onSubmit({
      ...v,
      names: names.map((n) => n.trim()).filter(Boolean),
      ageMin: v.ageMin === '' ? null : Number(v.ageMin),
      ageMax: v.ageMax === '' ? null : Number(v.ageMax),
    });
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <fieldset className="stack" style={{ gap: 0 }}>
        <legend>Their name</legend>
        <span className="field-hint">
          Add every name they might go by: nicknames, a maiden name, other spellings. Each one helps.
        </span>
        {names.map((n, i) => (
          <div key={i} className="row" style={{ flexWrap: 'nowrap', marginTop: i ? '0.5rem' : 0 }}>
            <input className="input" value={n} onChange={setName(i)} autoComplete="off"
              aria-label={i ? `Other name ${i}` : 'Name'} placeholder={i ? 'Another name' : 'Full name'} />
            {names.length > 1 && (
              <button type="button" className="linkish" onClick={() => setNames(names.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="linkish" style={{ marginTop: '0.6rem' }}
          onClick={() => setNames([...names, ''])} disabled={names.length >= 10}>
          Add another name
        </button>
      </fieldset>

      <label className="field">
        <span className="field-label">{who === 'you' ? 'How do you know them?' : 'How do they know each other?'}</span>
        <input className="input" value={v.relationship} onChange={set('relationship')} placeholder="Sister, son, neighbor…" />
      </label>

      <div className="field">
        <span className="field-label" id="search-age">Their age</span>
        <span className="field-hint">A range is fine. Leave blank if you're not sure.</span>
        <div className="age-range" role="group" aria-labelledby="search-age">
          <input className="input" inputMode="numeric" aria-label="Youngest" placeholder="From" value={v.ageMin} onChange={set('ageMin')} />
          <span className="muted">to</span>
          <input className="input" inputMode="numeric" aria-label="Oldest" placeholder="To" value={v.ageMax} onChange={set('ageMax')} />
        </div>
      </div>

      <label className="field">
        <span className="field-label">Where they lived</span>
        <input className="input" value={v.homeArea} onChange={set('homeArea')} placeholder="Street, neighborhood, or building" />
      </label>

      <label className="field">
        <span className="field-label">Anything that would help a volunteer recognize them</span>
        <span className="field-hint">What they look like, where they were when the evacuation started.</span>
        <textarea className="textarea" value={v.description} onChange={set('description')} />
      </label>

      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn btn-block" disabled={busy}>{busy ? 'Starting…' : submitLabel}</button>
      {onCancel && <button type="button" className="btn btn-quiet btn-block" onClick={onCancel}>Cancel</button>}
    </form>
  );
}
