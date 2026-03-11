"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "@/app/(public)/public.module.css";

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

type ContactFormErrors = Partial<Record<keyof ContactFormState, string>>;

const initialState: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  message: "",
};

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(values: ContactFormState): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!validateEmail(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.message.trim()) {
    errors.message = "Message is required.";
  }

  return errors;
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormState>(initialState);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);

    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 650));

    setSubmitting(false);
    setSubmitted(true);
    setValues(initialState);
  }

  return (
    <form className={styles.contactForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.formRow}>
        <label htmlFor="name" className={styles.formField}>
          <span className={styles.fieldLabel}>Name *</span>
          <input
            id="name"
            name="name"
            type="text"
            value={values.name}
            onChange={(event) => {
              setValues((current) => ({ ...current, name: event.target.value }));
            }}
            className={styles.fieldInput}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name ? (
            <span id="contact-name-error" className={styles.fieldError}>
              {errors.name}
            </span>
          ) : null}
        </label>

        <label htmlFor="email" className={styles.formField}>
          <span className={styles.fieldLabel}>Email *</span>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => {
              setValues((current) => ({ ...current, email: event.target.value }));
            }}
            className={styles.fieldInput}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email ? (
            <span id="contact-email-error" className={styles.fieldError}>
              {errors.email}
            </span>
          ) : null}
        </label>
      </div>

      <label htmlFor="phone" className={styles.formField}>
        <span className={styles.fieldLabel}>Phone</span>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={(event) => {
            setValues((current) => ({ ...current, phone: event.target.value }));
          }}
          className={styles.fieldInput}
          autoComplete="tel"
        />
      </label>

      <label htmlFor="message" className={styles.formField}>
        <span className={styles.fieldLabel}>Message *</span>
        <textarea
          id="message"
          name="message"
          value={values.message}
          onChange={(event) => {
            setValues((current) => ({ ...current, message: event.target.value }));
          }}
          className={styles.fieldTextarea}
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message ? (
          <span id="contact-message-error" className={styles.fieldError}>
            {errors.message}
          </span>
        ) : null}
      </label>

      <div className={styles.formActions}>
        <button
          type="submit"
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={submitting}
        >
          {submitting ? "Sending..." : "Send Message"}
        </button>

        {submitted ? (
          <p className={styles.formMessageSuccess} role="status">
            Thank you. Your message has been sent.
          </p>
        ) : null}

        {hasErrors ? (
          <p className={styles.formMessageError} role="alert">
            Please review the required fields and try again.
          </p>
        ) : null}
      </div>
    </form>
  );
}
