// src/components/pool/TagPicker.tsx
'use client';
import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CategoryKey } from '@/types';
import { cn } from '@/lib/utils';
import { getTagLabel, isKnownTag, normalizeCustomTag, TAG_GROUPS } from '@/lib/tags';

const CHIP_OFF = 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80';

interface TagPickerProps {
  /** Verilirse yalnızca bu kategoriye uygun etiket grupları gösterilir. */
  category?: CategoryKey;
  selected: string[];
  onToggle: (tag: string) => void;
  /** Seçili etiket rozetinin renk sınıfı. */
  activeClass: string;
  /** Havuzda daha önce kullanılmış özel etiketler (yazım tutarlı kalsın diye öneri olarak sunulur). */
  customSuggestions?: string[];
  allowCustom?: boolean;
}

export function TagPicker({
  category,
  selected,
  onToggle,
  activeClass,
  customSuggestions = [],
  allowCustom = true,
}: TagPickerProps) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const groups = TAG_GROUPS.filter((g) => !g.onlyForCategories || !category || g.onlyForCategories.includes(category));
  const customSelected = selected.filter((tag) => !isKnownTag(tag));

  const addCustom = () => {
    const tag = normalizeCustomTag(draft);
    setDraft('');
    if (!tag || selected.includes(tag)) return;
    onToggle(tag);
  };

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1">{group.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const active = selected.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(tag.key)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-full border transition-colors',
                    active ? activeClass : CHIP_OFF
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {(customSelected.length > 0 || allowCustom) && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1">Özel etiketler</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {customSelected.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onToggle(tag)}
                title="Kaldır"
                className={cn('text-xs pl-2 pr-1.5 py-1 rounded-full border flex items-center gap-1', activeClass)}
              >
                {getTagLabel(tag)}
                <X className="w-3 h-3 opacity-70" />
              </button>
            ))}
            {allowCustom && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  list={listId}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="Yeni etiket..."
                  className="w-28 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <datalist id={listId}>
                  {customSuggestions
                    .filter((tag) => !selected.includes(tag))
                    .map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                </datalist>
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!draft.trim()}
                  aria-label="Etiketi ekle"
                  className="p-1 rounded-full border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface IngredientInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  activeClass: string;
}

/** Baskın bileşenler için çip girişi: Enter veya virgülle eklenir, yazım küçük harfe sabitlenir. */
export function IngredientInput({ value, onChange, suggestions, activeClass }: IngredientInputProps) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  const commit = (raw: string) => {
    const parts = raw
      .split(',')
      .map((part) => part.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR'))
      .filter(Boolean);
    setDraft('');
    const next = [...value];
    parts.forEach((part) => {
      if (!next.includes(part)) next.push(part);
    });
    if (next.length !== value.length) onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((ingredient) => (
        <button
          key={ingredient}
          type="button"
          onClick={() => onChange(value.filter((v) => v !== ingredient))}
          title="Kaldır"
          className={cn('text-xs pl-2 pr-1.5 py-1 rounded-full border flex items-center gap-1', activeClass)}
        >
          {ingredient}
          <X className="w-3 h-3 opacity-70" />
        </button>
      ))}
      <input
        type="text"
        list={listId}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          // Virgül yazılınca o ana kadarki bileşen hemen eklenir.
          if (v.includes(',')) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={value.length ? 'Ekle...' : 'örn. mercimek, patates'}
        className="flex-1 min-w-[7rem] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
