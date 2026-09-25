import { useMemo } from "react";
import { useTranslation } from "@/i18n/context";
import { getTestimonials } from "@/data/testimonials";
import { TestimonialsSlider } from "@/components/testimonials-slider";

/**
 * Keeps the multilingual testimonial dataset and slider implementation in a
 * below-the-fold chunk instead of the homepage's initial JavaScript.
 */
export default function HomepageTestimonials() {
  const { language } = useTranslation();
  const testimonials = useMemo(() => getTestimonials(language), [language]);

  return <TestimonialsSlider testimonials={testimonials} />;
}
