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
      <ScrollProgress />
      <Navbar />
      <main>
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
