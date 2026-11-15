import type { ComponentType } from 'react';
import { categoryById, type CategoryId } from '../products/catalog';
import { useHaunted } from '../store';
import { scrollToGrid } from './Header';
import { CakeIcon, EnvelopeIcon, GiftIcon, RockingHorseIcon } from './icons';
import { useShopQuery } from './useQuery';

const TILES: { id: CategoryId; Icon: ComponentType<{ size?: number }>; day: string; haunted: string }[] = [
  { id: 'gifts', Icon: GiftIcon, day: 'Wrapped and ready', haunted: 'Never opened' },
  { id: 'toys', Icon: RockingHorseIcon, day: 'For little hands', haunted: 'Outgrown' },
  { id: 'sweets', Icon: CakeIcon, day: 'Baked this morning', haunted: 'Left on the table' },
  { id: 'letters', Icon: EnvelopeIcon, day: 'Say it this year', haunted: 'Never sent' },
];

export function CategoryTiles() {
  const haunted = useHaunted();
  const [query, update] = useShopQuery();
  return (
    <nav className="category-tiles" aria-label="Shop by category">
      <ul>
        {TILES.map(({ id, Icon, day, haunted: h }) => {
          const c = categoryById(id);
          const active = query.categories.length === 1 && query.categories[0] === id;
          return (
            <li key={id}>
              <button
                type="button"
                className="category-tile"
                data-perch={`tile-${id}`}
                aria-pressed={active}
                onClick={() => {
                  update({ categories: active ? [] : [id] });
                  scrollToGrid();
                }}
              >
                <span className="tile-icon">
                  <Icon size={30} />
                </span>
                <span className="tile-name">{haunted ? c.haunted : c.day}</span>
                <span className="tile-sub">{haunted ? h : day}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
