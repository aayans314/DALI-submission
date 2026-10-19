// The reference slip. Shaped like a luggage tag, in hi-vis yellow.
export default function RefTag({ code, name, small = false }) {
  return (
    <div className={small ? 'tag tag-small' : 'tag'}>
      <span className="tag-label">Reference code</span>
      <span className="tag-code" aria-label={code.split('').join(' ')}>{code}</span>
      {name && <span className="tag-name">{name}</span>}
    </div>
  );
}
