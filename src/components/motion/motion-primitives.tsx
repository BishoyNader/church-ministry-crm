"use client";

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion";

type MotionDivProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

export function FadeIn({ children, className, delay = 0, ...rest }: MotionDivProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0.01 : 0.3,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type SlideUpProps = MotionDivProps & {
  distance?: number;
};

export function SlideUp({
  children,
  className,
  delay = 0,
  distance = 12,
  ...rest
}: SlideUpProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.01 : 0.4,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerListProps = MotionDivProps & {
  stagger?: number;
  delayChildren?: number;
};

export function StaggerList({
  children,
  className,
  stagger = 0.05,
  delayChildren = 0,
  ...rest
}: StaggerListProps) {
  const reduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduceMotion ? 0 : stagger, delayChildren },
    },
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = MotionDivProps & {
  distance?: number;
};

export function StaggerItem({ children, className, distance = 10, ...rest }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();

  const itemVariants: Variants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div className={className} variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

export function PageTransition({ children, className, ...rest }: MotionDivProps) {
  return (
    <SlideUp className={className} distance={6} {...rest}>
      {children}
    </SlideUp>
  );
}
