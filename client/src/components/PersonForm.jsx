import { useState } from 'react';

// Shared by "register someone new" and "edit details".
export default function PersonForm({ initial = {}, submitLabel, busy, error, onSubmit, onCancel }) {
  const [v, setV] = useState({
    name: initial.name ?? '',
    ageMin: initial.ageMin ?? '',
    ageMax: initial.ageMax ?? '',
    homeArea: initial.homeArea ?? '',
    description: initial.description ?? '',
    isMinor: initial.isMinor ?? false,
    doNotDisclose: initial.doNotDisclose ?? false,
  });
  const set = (key) => (e) => setV({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const under18 = v.ageMax !== '' && Number(v.ageMax) < 18;

  function submit(e) {
    e.preventDefault();
    onSubmit({
      ...v,
      ageMin: v.ageMin === '' ? null : Number(v.ageMin),
      ageMax: v.ageMax === '' ? null : Number(v.ageMax),
      isMinor: v.isMinor || under18,
    });
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Name</span>
        <span className="field-hint">Whatever name they give you. If they can't give one, write Unknown.</span>
        <input className="input" value={v.name} onChange={set('name')} autoComplete="off" required />
      </label>

      <div className="field">
        <span className="field-label" id="age-label">Age</span>
        <span className="field-hint">Not sure? Give a range. Leave blank if you have no idea.</span>
        <div className="age-range" role="group" aria-labelledby="age-label">
          <input className="input" inputMode="numeric" aria-label="Youngest" placeholder="From"
            value={v.ageMin} onChange={set('ageMin')} />
          <span className="muted">to</span>
          <input className="input" inputMode="numeric" aria-label="Oldest" placeholder="To"
            value={v.ageMax} onChange={set('ageMax')} />
        </div>
      </div>

      <label className="field">
        <span className="field-label">Where they lived</span>
        <span className="field-hint">Street, neighborhood, or building, like a nursing home.</span>
        <input className="input" value={v.homeArea} onChange={set('homeArea')} autoComplete="off" />
      </label>

      <label className="field">
        <span className="field-label">What they look like</span>
        <span className="field-hint">
          Anything that helps family recognize them. Other shelters see this when matching, so leave out private details.
        </span>
        <textarea className="textarea" value={v.description} onChange={set('description')} />
      </label>

      <label className="choice">
        <input type="checkbox" checked={v.isMinor || under18} disabled={under18} onChange={set('isMinor')} />
        <span>
          Under 18
          <span className="field-hint" style={{ margin: 0 }}>A coordinator must approve before any match is shared.</span>
        </span>
      </label>

      <fieldset>
        <legend>Can family find them through this system?</legend>
        <label className="choice">
          <input type="radio" name="dnd" checked={!v.doNotDisclose} onChange={() => setV({ ...v, doNotDisclose: false })} />
          <span>Yes. We'll still ask them before sharing anything.</span>
        </label>
        <label className="choice">
          <input type="radio" name="dnd" checked={v.doNotDisclose} onChange={() => setV({ ...v, doNotDisclose: true })} />
          <span>
            No, keep them private
            <span className="field-hint" style={{ margin: 0 }}>Searches for them always come back with no match.</span>
          </span>
        </label>
      </fieldset>

      {error && <div className="error" role="alert">{error}</div>}

      <button className="btn btn-block" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      {onCancel && <button type="button" className="btn btn-quiet btn-block" onClick={onCancel}>Cancel</button>}
    </form>
  );
}
