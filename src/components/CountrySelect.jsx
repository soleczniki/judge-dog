import { useState, useRef, useEffect } from "react";
import { T } from "../theme.js";
import { COUNTRIES } from "../countries.js";

export function CountrySelect({ label, value, onChange, error, placeholder = "Start typing a country…" }) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState(value || "");
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);
  const listRef             = useRef(null);

  // Keep query in sync if value is set externally
  useEffect(() => { setQuery(value || ""); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        // If query doesn't match any country, clear it
        if (!COUNTRIES.includes(query)) { setQuery(""); onChange(""); }
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [query]);

  const filtered = query.length === 0
    ? COUNTRIES
    : COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  function select(country) {
    setQuery(country);
    onChange(country);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e) {
    if (!open) { setOpen(true); return; }
    const items = listRef.current?.querySelectorAll("button");
    const focused = listRef.current?.querySelector("button:focus");
    const idx = Array.from(items||[]).indexOf(focused);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items?.[idx + 1] || items?.[0];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items?.[idx - 1] || items?.[items.length - 1];
      prev?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.focus();
    } else if (e.key === "Enter" && focused) {
      e.preventDefault();
      focused.click();
    }
  }

  return (
    <div ref={containerRef} style={{position:"relative",display:"flex",flexDirection:"column",gap:4}}>
      {label && <label style={{fontSize:12,fontWeight:500,color:T.textSub,letterSpacing:0.2}}>{label}</label>}

      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{
          padding:"10px 14px",
          border:`1.5px solid ${open ? T.accent : error ? T.red : T.border}`,
          borderRadius: open && filtered.length > 0 ? `${T.rsm}px ${T.rsm}px 0 0` : T.rsm,
          fontSize:14, fontFamily:"inherit", background:T.bg,
          outline:"none", color:T.text, width:"100%", boxSizing:"border-box",
          transition:"border-color .15s",
        }}
      />

      {open && filtered.length > 0 && (
        <div ref={listRef}
          style={{
            position:"absolute", top:"100%", left:0, right:0, zIndex:9999,
            background:T.bg,
            border:`1.5px solid ${T.accent}`,
            borderTop:"none",
            borderRadius:`0 0 ${T.rsm}px ${T.rsm}px`,
            maxHeight:220, overflowY:"auto",
            boxShadow:"0 4px 12px rgba(60,64,67,.18)",
          }}>
          {filtered.map(country => (
            <button key={country} type="button"
              onClick={() => select(country)}
              onKeyDown={handleKeyDown}
              style={{
                display:"block", width:"100%", textAlign:"left",
                padding:"9px 14px", border:"none", background:"none",
                fontSize:14, color:T.text, cursor:"pointer",
                fontFamily:"inherit", outline:"none",
                borderBottom:`1px solid ${T.border}`,
                transition:"background .1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
              onFocus={e => e.currentTarget.style.background = T.accentLight}
              onBlur={e => e.currentTarget.style.background = "none"}>
              {country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
