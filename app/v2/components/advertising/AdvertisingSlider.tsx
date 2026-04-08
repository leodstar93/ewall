"use client";

import { useEffect, useState } from "react";
import type { AdSlide } from "@/lib/types";
import styles from "./AdvertisingSlider.module.css";

interface Props {
  slides: AdSlide[];
  autoPlayMs?: number;
}

const slideIcons = [
  <svg key="s" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>,
  <svg key="m" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
  <svg key="u" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
];

export default function AdvertisingSlider({
  slides,
  autoPlayMs = 4000,
}: Props) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCurrent((value) => (value + 1) % slides.length);
    }, autoPlayMs);

    return () => clearInterval(timer);
  }, [slides.length, autoPlayMs]);

  const go = (index: number) => setCurrent((index + slides.length) % slides.length);

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <svg viewBox="0 0 14 14" fill="none" stroke="var(--r)" strokeWidth="2">
            <rect x="1" y="2" width="12" height="9" rx="1" />
            <path d="M5 11v2M9 11v2M3 13h8" />
          </svg>
          Advertising
        </div>
        <span className={styles.progress}>
          {current + 1} / {slides.length}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.wrap}>
          {slides.map((slide, index) => (
            <div
              key={`${slide.title}-${index}`}
              className={`${styles.slide} ${index === current ? styles.active : ""}`}
              style={{ background: slide.gradient }}
            >
              <div className={styles.icon}>{slideIcons[index % slideIcons.length]}</div>
              <div className={styles.text}>
                <div className={styles.eyebrow}>{slide.eyebrow}</div>
                <div className={styles.title}>{slide.title}</div>
                <div className={styles.desc}>{slide.description}</div>
                <button type="button" className={styles.cta}>
                  {slide.cta} {"->"}
                </button>
              </div>
            </div>
          ))}

          <div className={styles.navRow}>
            <button type="button" className={styles.navBtn} onClick={() => go(current - 1)}>
              {"<"}
            </button>
            <button type="button" className={styles.navBtn} onClick={() => go(current + 1)}>
              {">"}
            </button>
          </div>

          <div className={styles.dots}>
            {slides.map((slide, index) => (
              <button
                type="button"
                key={`${slide.title}-dot-${index}`}
                className={`${styles.dot} ${index === current ? styles.dotActive : ""}`}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
