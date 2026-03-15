import { Suspense, lazy } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ExperienceCarousel from "./components/ExperienceCarousel";
import Stack from "./components/Stack";
import About from "./components/About";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import ScrollProgress from "./components/ScrollProgress";

const ExploreButton = lazy(() => import("./components/ExploreButton"));

export default function App() {
  return (
    <div className="bg-bg-primary min-h-screen text-text-secondary overflow-x-hidden">
      {/* Skip to content — accessibility */}
      <a href="#experience" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-accent-cyan focus:text-bg-primary focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold">
        Skip to content
      </a>
      <ScrollProgress />
      <Navbar />
      <main id="main">
        <Hero />
        <ExperienceCarousel />
        <Stack />
        <About />
        <Contact />
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ExploreButton />
      </Suspense>
    </div>
  );
}
