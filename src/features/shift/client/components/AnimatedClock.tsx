'use client'

import { AnimatePresence, motion } from 'framer-motion'

export function AnimatedClock ({ value, className }: { value: string; className: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {value.split('').map((char, i) =>
        char === ':'
          ? (
              <span key="colon" style={{ lineHeight: 'inherit' }}>:</span>
            )
          : (
              <span
                key={i}
                style={{ display: 'inline-flex', overflow: 'hidden', position: 'relative', height: '1em', width: '0.65em', justifyContent: 'center' }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={char}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ position: 'absolute' }}
                  >
                    {char}
                  </motion.span>
                </AnimatePresence>
              </span>
            )
      )}
    </span>
  )
}
