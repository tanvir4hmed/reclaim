import { useRef, type FormEvent, type KeyboardEvent } from 'react';
import { CATEGORIES } from '../products/catalog';
import { isHauntedPhase } from '../core';
import { dispatch, useHaunted, useStory, useUi } from '../store';
import { CartIcon, HeartIcon, SearchIcon, UserIcon } from './icons';
import { Logo } from './Logo';
import { HAUNTED_SEARCH, cartCount, type Query } from './query';
import { useShopQuery } from './useQuery';

/** Typing in the search box. In the Haunted state some words summon a new product (Req 32.8). */
function onSearchInput(value: string, update: (patch: Partial<Query>) => void) {
  update({ q: value });
  const term = value.trim().toLowerCase();
  if (HAUNTED_SEARCH.includes(term) && isHauntedPhase(useStory.getState().story.phase)) {
    dispatch({ type: 'CATALOG_EXTRA', id: 'childs-drawing' });
  }
}

export function scrollToGrid() {
  document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SearchBox() {
  const haunted = useHaunted();
  const [query, update] = useShopQuery();
  const input = useRef<HTMLInputElement>(null);
  const text = query.q;

  function submit(e: FormEvent) {
    e.preventDefault();
    update({ q: text.trim() });
    scrollToGrid();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && text) {
      e.preventDefault();
      update({ q: '' });
    }
  }

  return (
    <form role="search" className="search" onSubmit={submit}>
      <label htmlFor="site-search" className="sr-only">
        Search the shop
      </label>
      <SearchIcon className="search-icon" />
      <input
        ref={input}
        id="site-search"
        type="search"
        value={text}
        autoComplete="off"
        placeholder={haunted ? 'What are you looking for?' : 'Search gifts, toys, sweets…'}
        onChange={(e) => onSearchInput(e.target.value, update)}
        onKeyDown={onKey}
      />
    </form>
  );
}

export function Header() {
  const haunted = useHaunted();
  const count = useStory((s) => cartCount(s.story.cart));
  const wishCount = useUi((s) => s.wishlist.length);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const [, update] = useShopQuery();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav aria-label="Categories" className="main-nav">
          <ul>
            {CATEGORIES.slice(0, 4).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="nav-link"
                  onClick={() => {
                    update({ categories: [c.id] });
                    scrollToGrid();
                  }}
                >
                  {haunted ? c.haunted : c.day}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <SearchBox />
        <div className="header-actions">
          <button type="button" className="icon-button" aria-label="Account">
            <UserIcon />
          </button>
          <button type="button" className="icon-button" aria-label={`Wishlist, ${wishCount} saved`} data-testid="wishlist-icon">
            <HeartIcon />
            {wishCount > 0 && <span className="badge badge-quiet">{wishCount}</span>}
          </button>
          <button
            type="button"
            className="icon-button cart-button"
            data-testid="cart-icon"
            aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
            onClick={() => setCartOpen(true)}
          >
            <CartIcon size={22} />
            {count > 0 && <span className="badge" aria-hidden="true">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
