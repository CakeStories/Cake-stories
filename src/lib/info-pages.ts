/**
 * The footer's information pages. The wording here is a starting draft —
 * every heading and paragraph can be rewritten in the website editor.
 */
export type InfoPage = {
  slug: string;
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

export const INFO_PAGES: InfoPage[] = [
  {
    slug: "our-story",
    title: "Our Story",
    intro: "Cake Stories began with a simple idea: every celebration deserves a cake that's baked fresh and made with care.",
    sections: [
      {
        heading: "Baked fresh, every time",
        body: "Every cake is baked after you order, in our own kitchens, using quality ingredients. No shortcuts, no cakes sitting on a shelf.",
      },
      {
        heading: "Our stores",
        body: "You'll find us in Marthandam, Pammam and Anducode. Visit any of our outlets, or order online for delivery or store pickup.",
      },
      {
        heading: "Made for your moments",
        body: "From first birthdays to weddings and anniversaries, we love being part of the moments that matter to you.",
      },
    ],
  },
  {
    slug: "careers",
    title: "Careers",
    intro: "We're always happy to hear from bakers, decorators and friendly people who love great service.",
    sections: [
      {
        heading: "Work with us",
        body: "We look for people who care about quality and enjoy making customers happy — in the kitchen, at our stores and on the road.",
      },
      {
        heading: "How to apply",
        body: "Send your name, the role you're interested in and a little about yourself to our team on WhatsApp at 7907518447, or drop in at any of our stores.",
      },
    ],
  },
  {
    slug: "cancellation-refund-policy",
    title: "Cancellation & Refund Policy",
    intro: "We bake every order fresh, so please read how cancellations and refunds work before you order.",
    sections: [
      {
        heading: "Cancelling an order",
        body: "To cancel, contact our Customer Care team on 7907518447 as soon as possible. Orders cancelled before we start preparing them are eligible for a refund.",
      },
      {
        heading: "Orders already being prepared",
        body: "Once your cake is being baked or decorated, or for customised cakes made to your design, we may not be able to cancel or refund the order.",
      },
      {
        heading: "Problems with your order",
        body: "If something isn't right when your order arrives, please contact us the same day with your order details and a photo, and we'll make it right.",
      },
      {
        heading: "Refunds",
        body: "Approved refunds are returned to your original payment method. Your bank may take a few working days to show the amount.",
      },
    ],
  },
  {
    slug: "corporate-cakes",
    title: "Corporate Cakes",
    intro: "Celebrate team milestones, launches and festivals with cakes made for your company.",
    sections: [
      {
        heading: "For every occasion",
        body: "Employee birthdays, work anniversaries, product launches, client gifting and festive celebrations — we can bake for one event or set up a regular order.",
      },
      {
        heading: "Your brand on a cake",
        body: "Add your company logo, colours or a custom message. Bulk orders are welcome.",
      },
      {
        heading: "Get a quote",
        body: "Tell us the date, number of guests and what you have in mind on WhatsApp at 7907518447, and we'll get back to you with options.",
      },
    ],
  },
  {
    slug: "faqs",
    title: "FAQs",
    intro: "Answers to the questions we're asked most often.",
    sections: [
      {
        heading: "Where do you deliver?",
        body: "We deliver cakes within a 15 km radius of our stores. You can also order for pickup from any of our outlets. Party Essentials, Cookies & Brownies can be delivered anywhere across India.",
      },
      {
        heading: "How much notice do you need?",
        body: "Many cakes are available for same-day delivery. Customised and themed cakes need at least 24 hours' notice.",
      },
      {
        heading: "Can I get a customised cake?",
        body: "Yes. Open any customisable cake and send us an enquiry on WhatsApp with your idea, and we'll help you plan it.",
      },
      {
        heading: "How do I pay?",
        body: "You can pay securely online at checkout.",
      },
      {
        heading: "How can I contact you?",
        body: "Call or WhatsApp our Customer Care team at 7907518447. We're happy to help!",
      },
    ],
  },
];

export function findInfoPage(slug: string): InfoPage | undefined {
  return INFO_PAGES.find((page) => page.slug === slug);
}
