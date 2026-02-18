"use client";

import { useAbstraxionAccount } from "@burnt-labs/abstraxion";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { saveReferrer } from "@/lib/referrer";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Confetti } from "@/components/ui/Confetti";
import { PyramidSpinner } from "@/components/ui/PyramidSpinner";
import { useMembershipStatus } from "@/hooks/useMembershipStatus";

// FAQ Accordion Component
interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is the Pyramid?",
    answer: "A members-only chat community where entry costs $8 and recruiting earns you $5 per initiate. Simple arithmetic. Eternal potential."
  },
  {
    question: "How do I earn?",
    answer: "Share your unique referral link. When someone enters through your link, you earn $5 instantly. There's no cap on how many you can recruit."
  },
  {
    question: "Is this a scheme?",
    answer: "All structures are schemes. Corporations, governments, social networks. Ours is just more honest about the architecture."
  },
  {
    question: "Where does the money go?",
    answer: "$5 goes to your recruiter (or the treasury if you have none). $3 funds operations and growth. 100% transparent. No hidden fees."
  }
];

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-container">
      {faqItems.map((item, index) => (
        <div key={index} className="accordion-item">
          <button
            className="accordion-trigger"
            onClick={() => toggleItem(index)}
            aria-expanded={openIndex === index}
            aria-controls={`faq-content-${index}`}
          >
            <span>{item.question}</span>
            <svg
              className="accordion-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div
            id={`faq-content-${index}`}
            role="region"
            className="accordion-content"
            style={{
              maxHeight: openIndex === index ? '200px' : '0px'
            }}
          >
            <div className="accordion-content-inner">
              {item.answer}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Testimonials data
const testimonials = [
  {
    username: "apex_initiate",
    quote: "I entered skeptical. I left with 12 initiates beneath me. The structure provides."
  },
  {
    username: "shadow_recruit_42",
    quote: "The Algorithm favors the bold. My link did the rest. $60 in my first week."
  },
  {
    username: "pyramid_architect",
    quote: "I didn't find the Pyramid. The Pyramid found me. Now I build it higher."
  }
];

interface GlobalStats {
  members: number;
  totalPaidOut: string;
}

function HomeContent() {
  const { isConnected, isConnecting, isReturningFromAuth, login } = useAbstraxionAccount();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  // Save referrer immediately when user lands via referral link
  useEffect(() => {
    if (ref) {
      saveReferrer(ref);
    }
  }, [ref]);

  const [stats, setStats] = useState<GlobalStats>({ members: 0, totalPaidOut: "0.00" });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Unified membership check (blockchain + database)
  const { isMember, username, isLoading: membershipLoading } = useMembershipStatus();
  const router = useRouter();

  // Track if we've already handled the redirect for this auth session
  const hasRedirectedRef = useRef(false);

  // Auto-redirect to /join only when returning from fresh authentication AND not a member
  // isReturningFromAuth is true when user just completed the auth flow
  useEffect(() => {
    if (
      isReturningFromAuth &&
      isConnected &&
      !membershipLoading &&
      !isMember &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      const destination = ref ? `/join?ref=${ref}` : "/join";
      router.push(destination);
    }
  }, [isReturningFromAuth, isConnected, isMember, membershipLoading, ref, router]);
  const [pyramidClicks, setPyramidClicks] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const pyramidRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollIndicatorVisible, setScrollIndicatorVisible] = useState(true);
  const pathSectionRef = useRef<HTMLElement>(null);

  // Scroll indicator visibility
  useEffect(() => {
    const handleScroll = () => {
      setScrollIndicatorVisible(window.scrollY < 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToPath = useCallback(() => {
    pathSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch global stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // Pyramid easter egg - 2 clicks = glitch, 10 clicks = pyramid shower
  const handlePyramidClick = () => {
    const newCount = pyramidClicks + 1;
    setPyramidClicks(newCount);

    if (newCount === 2) {
      // Quick glitch effect at 2 clicks
      setShowGlitch(true);
      setTimeout(() => setShowGlitch(false), 500);
    } else if (newCount >= 10) {
      // Pyramid shower at 10 clicks
      setShowGlitch(true);
      setShowConfetti(true);
      setPyramidClicks(0);
      setTimeout(() => setShowGlitch(false), 1500);
    }
  };

  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  // Track mouse position for spotlight effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Cryptic messages for background
  const crypticMessages = [
    "THE EYE SEES ALL",
    "ASCEND THE PYRAMID",
    "NOVUS ORDO SECLORUM",
    "AS ABOVE SO BELOW",
    "$5 PER SOUL",
    "THE ARCHITECTURE OF CONTROL",
    "TRUST THE ALGORITHM",
    "WEALTH FLOWS UPWARD",
    "ILLUMINATE YOUR PATH",
    "THE HIERARCHY IS ETERNAL",
    "PROFIT IS DIVINE",
    "ENTER THE ORDER",
    "THE CAPSTONE AWAITS",
    "ANNUIT COEPTIS",
    "BUILD YOUR EMPIRE",
    "THE NETWORK EXPANDS",
    "RECRUIT OR BE FORGOTTEN",
    "POWER IN NUMBERS",
    "THE SCHEME IS SACRED",
    "PROSPERITY THROUGH HIERARCHY"
  ];

  return (
    <>
      {/* Pyramid easter egg confetti */}
      <Confetti
        active={showConfetti}
        onComplete={() => setShowConfetti(false)}
        particleCount={60}
      />

      {/* Mouse spotlight effect */}
      <div
        className="spotlight"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
        }}
      />

      {/* Background graffiti text */}
      <div className="graffiti-layer">
        {crypticMessages.map((message, i) => {
          const x = (i * 73 + 23) % 120 - 10; // More scattered positioning (can go off-screen)
          const y = (i * 97 + 41) % 130 - 15;
          const rotation = (i * 17) % 60 - 30;
          const size = 0.8 + (i % 3) * 0.2;

          // Calculate distance from mouse to text for brightness
          const textX = (x / 100) * (typeof window !== 'undefined' ? window.innerWidth : 1920);
          const textY = (y / 100) * (typeof window !== 'undefined' ? window.innerHeight : 1080);
          const distance = Math.sqrt(
            Math.pow(mousePosition.x - textX, 2) + Math.pow(mousePosition.y - textY, 2)
          );
          const maxDistance = 300;
          const brightness = Math.max(0, 1 - distance / maxDistance);

          return (
            <span
              key={i}
              className="graffiti-text"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `rotate(${rotation}deg)`,
                fontSize: `${size}rem`,
                opacity: 0.02 + brightness * 0.15, // Very dim background
              }}
            >
              {message}
            </span>
          );
        })}
      </div>

      {/* Navigation */}
      <nav className="navbar">
        <Link href="/" className="navbar-brand">
          <span>△</span>
          <span>PYRAMID</span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Backroom link - locked for non-members */}
          {isMember ? (
            <Link href="/chat" className="btn btn-ghost btn-sm">
              Backroom
            </Link>
          ) : (
            <span className="btn btn-ghost btn-sm opacity-50 cursor-not-allowed" title="Members only">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Backroom
            </span>
          )}

          {isConnected ? (
            <Link href={isMember ? "/dashboard" : "/join"} className="btn btn-primary btn-sm">
              {isMember ? "Recruit" : "Enter"}
            </Link>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleConnect}
              disabled={isConnecting || isReturningFromAuth}
            >
              {isConnecting || isReturningFromAuth ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero" id="main-content">
        {/* Pyramid Logo - Clickable Easter Egg */}
        <div
          className={`pyramid-logo cursor-pointer select-none ${showGlitch ? 'animate-glitch' : ''}`}
          onClick={handlePyramidClick}
          ref={pyramidRef}
          title="△"
        >
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="pyramidGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="hsl(160 84% 50%)" />
                <stop offset="100%" stopColor="hsl(160 84% 35%)" />
              </linearGradient>
            </defs>
            <polygon points="80,12 148,130 12,130" fill="url(#pyramidGrad)" opacity="0.9" />
            <polygon points="80,35 125,110 35,110" fill="hsl(220 14% 6%)" opacity="0.4" />
            <polygon points="80,52 105,95 55,95" fill="url(#pyramidGrad)" opacity="0.5" />
            <circle cx="80" cy="80" r="8" fill="hsl(220 14% 6%)" />
            <circle cx="80" cy="80" r="4" fill="hsl(160 84% 50%)" />
          </svg>
        </div>

        {/* Personalized greeting for returning members */}
        {isMember && username ? (
          <>
            <p className="text-sm text-primary tracking-wider" style={{ marginTop: '-0.5rem', marginBottom: '0.25rem' }}>
              Welcome back, <span className="font-semibold">{username}</span>
            </p>
            <h1 className="hero-title" style={{ marginBottom: '1rem' }}>Your Pyramid Awaits</h1>
          </>
        ) : (
          <h1 className="hero-title">Enter the Pyramid</h1>
        )}

        <p className="hero-subtitle">
          $8 to enter · Earn $5 per recruit
        </p>

        <div className="flex flex-col items-center gap-4">
          {isConnected ? (
            <Link
              href={isMember ? "/dashboard" : (ref ? `/join?ref=${ref}` : "/join")}
              className="btn btn-primary btn-lg"
            >
              {isMember ? "Recruit" : "Enter"}
            </Link>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleConnect}
              disabled={isConnecting || isReturningFromAuth}
            >
              {isConnecting || isReturningFromAuth ? "Connecting..." : "Proceed"}
            </button>
          )}
        </div>

        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-value">
              {isLoadingStats ? (
                <div className="skeleton skeleton-text w-16 h-8"></div>
              ) : (
                <AnimatedCounter value={stats.members} format="number" />
              )}
            </div>
            <div className="stat-label">Members</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {isLoadingStats ? (
                <div className="skeleton skeleton-text w-20 h-8"></div>
              ) : (
                <AnimatedCounter
                  value={parseFloat(stats.totalPaidOut)}
                  format="currency"
                  decimals={2}
                />
              )}
            </div>
            <div className="stat-label">Paid Out</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">∞</div>
            <div className="stat-label">Potential</div>
          </div>
        </div>

              {/* Scroll Indicator */}
        <div
          className="scroll-indicator animate-bounce-gentle"
          onClick={scrollToPath}
          style={{ opacity: scrollIndicatorVisible ? 1 : 0, marginTop: '2rem' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && scrollToPath()}
          aria-label="Scroll to explore"
        >
          <div className="scroll-indicator-chevrons" aria-hidden="true">
            <svg className="scroll-indicator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <svg className="scroll-indicator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <span className="scroll-indicator-text">Scroll to explore</span>
        </div>
      </section>

      {/* The Path - How It Works */}
      <section ref={pathSectionRef} className="landing-section section-the-path" id="the-path">
        <h2 className="section-title">The Path</h2>
        <div className="path-steps">
          <div className="path-step">
            <span className="path-step-number">01</span>
            <svg className="path-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <polygon points="12 2 22 20 2 20" />
            </svg>
            <h3 className="path-step-title">Pledge</h3>
            <p className="path-step-description">Pay $8 to enter the Pyramid. Receive your unique initiation link.</p>
          </div>
          <div className="path-step">
            <span className="path-step-number">02</span>
            <svg className="path-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <h3 className="path-step-title">Recruit</h3>
            <p className="path-step-description">Share your link. Each soul who enters through you becomes your initiate.</p>
          </div>
          <div className="path-step">
            <span className="path-step-number">03</span>
            <svg className="path-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
              <line x1="5" y1="19" x2="19" y2="19" />
            </svg>
            <h3 className="path-step-title">Ascend</h3>
            <p className="path-step-description">Earn $5 for every recruit. The higher you rise, the more you earn.</p>
          </div>
        </div>
      </section>

      {/* The Voices - Testimonials */}
      <section className="landing-section section-the-voices">
        <h2 className="section-title">The Voices</h2>
        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar">
                  {testimonial.username.replace(/[^a-zA-Z]/g, '')[0]?.toUpperCase() || '△'}
                </div>
                <span className="testimonial-username">{testimonial.username}</span>
              </div>
              <div className="testimonial-rating">△△△△△</div>
              <p className="testimonial-quote">&ldquo;{testimonial.quote}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Manifesto - Mission */}
      <section className="section-the-manifesto">
        <h2 className="section-title">The Manifesto</h2>
        <h2 className="manifesto-headline">The Scheme is Sacred</h2>
        <p className="manifesto-body">
          In a world of noise, we offer clarity. One structure. One path. Eight dollars to enter. Infinite potential to rise. This is simple math.
        </p>
      </section>

      {/* The Questions - FAQ */}
      <section className="landing-section section-the-questions">
        <h2 className="section-title">The Questions</h2>
        <FAQAccordion />
      </section>

      {/* The Gathering - Meetups */}
      <section className="landing-section section-the-gathering">
        <h2 className="section-title">The Gathering</h2>
        <div className="gathering-card">
          <span className="gathering-badge">Coming Soon</span>
          <h3 className="gathering-title">Pyramid Summit 2026</h3>
          <p className="gathering-location">Location to be revealed</p>
          <p className="gathering-description">
            When the structure reaches critical mass, we gather. First 1,000 members receive priority access.
          </p>
          <Link href="/join" className="btn btn-primary">
            Join to be notified
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-content">
          <Link href="/" className="footer-brand">
            <span>△</span>
            <span>PYRAMID</span>
          </Link>
          <nav className="footer-nav">
            <Link href="/" className="footer-link">Home</Link>
            <Link href="/chat" className="footer-link">Backroom</Link>
            <Link href="/dashboard" className="footer-link">Headquarters</Link>
          </nav>
          <div className="footer-bottom">
            <span className="footer-copyright">© {new Date().getFullYear()} Pyramid. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

// Loading Fallback
function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <PyramidSpinner size="lg" />
      <p className="text-muted-foreground mt-4 text-sm">Loading...</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
