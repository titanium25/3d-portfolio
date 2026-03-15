import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Download, Mail, Linkedin } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export default function Contact() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="contact" className="relative py-28 px-6 dot-grid">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-accent-cyan/[0.03] blur-[80px] pointer-events-none" />

      <div ref={ref} className="relative mx-auto max-w-3xl text-center">
        <motion.p
          className="font-mono text-xs uppercase tracking-wider text-accent-cyan mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          What&apos;s next?
        </motion.p>

        <motion.h2
          className="font-display font-bold text-4xl text-text-primary mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease }}
        >
          Let&apos;s Build Something
        </motion.h2>

        <motion.p
          className="text-text-secondary max-w-lg mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease }}
        >
          I&apos;m open to new opportunities where I can own critical systems,
          mentor teams, and push frontend and backend architecture forward.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease }}
        >
          <a
            href="/AL_CV.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-accent-cyan text-bg-primary font-semibold rounded-lg px-6 py-3 animate-pulse-glow hover:brightness-110 transition-all"
          >
            <Download size={18} />
            Download CV
          </a>
          <a
            href="mailto:alex.lazarovichh@gmail.com"
            className="ghost-btn-light flex items-center gap-2 border border-accent-cyan/40 text-accent-cyan rounded-lg px-6 py-3 hover:bg-accent-cyan/10 transition-colors"
          >
            <Mail size={18} />
            Email
          </a>
          <a
            href="https://linkedin.com/in/alexander-lazarovich"
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-btn-light flex items-center gap-2 border border-border-subtle text-text-secondary rounded-lg px-6 py-3 hover:border-accent-cyan/30 hover:text-text-primary transition-colors"
          >
            <Linkedin size={18} />
            LinkedIn
          </a>
        </motion.div>

        <motion.p
          className="font-mono text-xs text-text-dim"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease }}
        >
          <a href="tel:+972544567302" className="hover:text-accent-cyan transition-colors">054-4567302</a> &middot; Ra&apos;anana, Israel
        </motion.p>
      </div>
    </section>
  );
}
