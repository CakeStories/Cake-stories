import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/accordion";
import { EditableText } from "@/components/editable";
import {
  CAKE_DELIVERY_RADIUS_KM,
  CAKE_GST_PERCENT,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  PARTY_ESSENTIALS_GST_PERCENT,
} from "@/lib/pricing";

const CARE_POINTS = [
  "Keep cream cakes refrigerated at 2–8°C until serving.",
  "Fondant cakes should be stored in a cool air-conditioned room. Refrigeration is recommended if the venue is warm.",
  "Avoid direct sunlight, excessive heat, and outdoor exposure for extended periods.",
  "For the best taste and texture, allow the cake to rest at room temperature for 20–30 minutes before serving.",
  "Use a clean serrated knife for smooth cutting.",
  "Multi-tier cakes may contain dowels, skewers, support rods, wires, or cake separators for structural stability. These must be removed carefully before serving. Adult supervision is recommended.",
  "Once assembled and displayed, avoid moving the cake unnecessarily.",
  "Consume within 24 hours of delivery for the best quality and freshness.",
];

const DELIVERY_POINTS = [
  `Cakes are delivered within ${CAKE_DELIVERY_RADIUS_KM} km of our shops in Marthandam, Pammam and Anducode. Party Essentials ordered on their own are delivered anywhere in India.`,
  `Delivery is ₹${DELIVERY_FEE}, free on orders above ₹${FREE_DELIVERY_THRESHOLD}. GST is added at checkout: ${CAKE_GST_PERCENT}% on cakes, ${PARTY_ESSENTIALS_GST_PERCENT}% on Party Essentials.`,
  "Every cake is freshly handcrafted, so slight variations in design and appearance may occur.",
  "Delivery timings are approximate and may vary depending on product availability and delivery location.",
  "As cakes are perishable, delivery will be attempted only once and cannot be redirected to another address.",
  "This product is hand-delivered and will not be shipped with courier items.",
  "In rare cases, flavour or design substitutions may be made due to temporary or regional availability.",
];

export function CheckoutInfoAccordion() {
  return (
    <Accordion type="single" collapsible className="mt-6 rounded-md border border-border px-4">
      <AccordionItem value="care">
        <AccordionTrigger className="text-sm font-semibold">
          <EditableText id="info.care.title">Cake Care Instructions</EditableText>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-4">
            {CARE_POINTS.map((point, index) => (
              <li key={index}>
                <EditableText id={`info.care.${index}`}>{point}</EditableText>
              </li>
            ))}
          </ul>
          <EditableText id="info.care.thanks" as="p" className="block">
            ✨ Thank you for choosing Cake Stories to be part of your celebration.
          </EditableText>
          <div className="border-t border-border pt-3 text-xs leading-5">
            <EditableText id="info.maker.title" as="p" className="block font-medium text-foreground">
              Manufactured & Packed By
            </EditableText>
            <EditableText id="info.maker.name" as="p" className="block">
              Foryn Ventures LLP
            </EditableText>
            <EditableText id="info.maker.unitTitle" as="p" className="mt-1 block font-medium text-foreground">
              Production Unit:
            </EditableText>
            <EditableText id="info.maker.address" as="p" className="block">
              Near Esakiamman Temple, Anducode, Edaicode (P.O), Kanyakumari, Tamil Nadu – 629168
            </EditableText>
            <EditableText id="info.maker.fssai" as="p" className="mt-1 block">
              FSSAI License No: 12425009000638
            </EditableText>
            <EditableText id="info.customerCare" as="p" className="block">
              Customer Care: +91 7907518447
            </EditableText>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="delivery">
        <AccordionTrigger className="text-sm font-semibold">
          <EditableText id="info.delivery.title">Delivery Information</EditableText>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-4">
            {DELIVERY_POINTS.map((point, index) => (
              <li key={index}>
                <EditableText id={`info.delivery.${index}`}>{point}</EditableText>
              </li>
            ))}
          </ul>
          <EditableText id="info.delivery.help" as="p" className="block">
            For assistance, contact Customer Care: +91 7907518447
          </EditableText>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="disclaimer" className="border-b-0">
        <AccordionTrigger className="text-sm font-semibold">
          <EditableText id="info.disclaimer.title">Design Disclaimer</EditableText>
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          <EditableText id="info.disclaimer.text" multiline>
            The images shown are for reference and illustration purposes only. As each cake is handcrafted, slight variations in design, colour, decorations, flowers, toppers, and finishing may occur. We will make every effort to create the cake as close as possible to the selected design while ensuring the best overall appearance and quality.
          </EditableText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
