"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

interface Suggestion {
  placeId: string;
  text: string;
  prediction: google.maps.places.PlacePrediction;
}

function extractCity(components: google.maps.places.AddressComponent[] | undefined): string | null {
  const byType = (type: string) =>
    components?.find((c) => c.types.includes(type))?.longText ?? null;
  return (
    byType("locality") ??
    byType("sublocality") ??
    byType("administrative_area_level_3") ??
    null
  );
}

const controlClass =
  "w-full rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-3 py-2 text-[12.5px] font-semibold text-[#16324f] outline-none transition-colors focus:border-[#088df9]";

/**
 * Address text input with Google Places autocomplete suggestions. Uses the
 * current (non-deprecated) AutocompleteSuggestion API — the older
 * google.maps.places.Autocomplete widget is unavailable to any Google Cloud
 * project created after March 2025, which this one is.
 *
 * Only assists the typed text; geocoding to lat/lng still happens
 * server-side on save (src/lib/geocode.ts), unchanged.
 */
export function AddressAutocomplete({
  id,
  value,
  onChange,
  onPlaceSelected,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (address: string) => void;
  /** Fired after the user picks a suggestion, once the city is resolved —
   * used to auto-populate the area field instead of a manual dropdown. */
  onPlaceSelected?: (info: { address: string; city: string | null }) => void;
  placeholder?: string;
}) {
  const placesLib = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const fetchSuggestions = (text: string) => {
    if (!placesLib || !text.trim()) {
      setSuggestions([]);
      return;
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: text,
      sessionToken: sessionTokenRef.current,
      includedRegionCodes: ["us"],
    })
      .then(({ suggestions: results }) => {
        setSuggestions(
          results
            .filter((s) => s.placePrediction)
            .map((s) => ({
              placeId: s.placePrediction!.placeId,
              text: s.placePrediction!.text.text,
              prediction: s.placePrediction!,
            })),
        );
        setOpen(true);
        setHighlighted(-1);
      })
      .catch((err) => {
        // Fail quiet for the user (suggestions just don't appear — typing
        // still works), but log once so a misconfigured/disabled "Places
        // API (New)" is easy to spot in devtools instead of looking like a
        // silent no-op.
        if (process.env.NODE_ENV !== "production") {
          console.warn("Places autocomplete unavailable:", err?.message ?? err);
        }
        setSuggestions([]);
      });
  };

  const handleChange = (text: string) => {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const selectSuggestion = (s: Suggestion) => {
    onChange(s.text);
    setSuggestions([]);
    setOpen(false);
    sessionTokenRef.current = null; // a selection ends the billing session

    if (onPlaceSelected) {
      s.prediction
        .toPlace()
        .fetchFields({ fields: ["addressComponents"] })
        .then(({ place }) => {
          onPlaceSelected({ address: s.text, city: extractCity(place.addressComponents) });
        })
        .catch(() => {
          // City lookup failed — address text is already set; area just
          // won't auto-populate from this selection (saving will still
          // re-derive it server-side).
        });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={controlClass}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[9px] border border-[#dbe7f3] bg-white py-1 shadow-[0_8px_20px_rgba(22,50,79,.14)]">
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
                className="block w-full px-3 py-2 text-left text-[12.5px] font-semibold text-[#16324f]"
                style={{ background: i === highlighted ? "#f2f8ff" : "#fff" }}
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
