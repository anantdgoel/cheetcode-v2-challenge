"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const REVEAL = { type: "spring" as const, stiffness: 300, damping: 30 };

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
      transition={{ ...REVEAL, delay }}
    >
      {children}
    </motion.div>
  );
}
