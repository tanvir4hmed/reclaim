import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation, type Location } from 'react-router';
import { Director } from './director/Director';
import { FxLayer } from './fx/FxLayer';
import { Receipt } from './fx/Receipt';
import { hasWebGL2 } from './gl/webgl';
import { CartDrawer } from './shop/CartDrawer';
import { CategoryTiles } from './shop/CategoryTiles';
import { Checkout } from './shop/Checkout';
import { Footer } from './shop/Footer';
import { Header } from './shop/Header';
import { Hero } from './shop/Hero';
import { LiveRegion } from './shop/LiveRegion';
import { ProductGrid } from './shop/ProductGrid';
import { ProductViewRoute } from './shop/ProductView';
import { SaleClock } from './shop/SaleClock';
import { Theme } from './shop/Theme';

const ShopCanvas = lazy(() => import('./gl/ShopCanvas'));

function ShopPage() {
  return (
    <main id="main">
      <Hero />
      <CategoryTiles />
      <ProductGrid />
    </main>
  );
}

function Routed() {
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;
  const onProduct = location.pathname.startsWith('/product/');
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SaleClock />
      <Header />
      <Routes location={background ?? (onProduct ? { ...location, pathname: '/' } : location)}>
        <Route path="/" element={<ShopPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="*" element={<ShopPage />} />
      </Routes>
      <Routes>
        <Route path="/product/:id" element={<ProductViewRoute />} />
        <Route path="*" element={null} />
      </Routes>
      <Footer />
      <CartDrawer />
      <LiveRegion />
      <FxLayer />
      <Director />
      {hasWebGL2() && (
        <Suspense fallback={null}>
          <ShopCanvas />
        </Suspense>
      )}
    </>
  );
}

export function App({ router = true }: { router?: boolean }) {
  const content = (
    <>
      <Theme />
      <Routed />
    </>
  );
  return router ? <BrowserRouter>{content}</BrowserRouter> : content;
}
