import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/accordion";

export function CheckoutInfoAccordion() {
  return (
    <Accordion type="single" collapsible className="mt-6 rounded-md border border-border px-4">
      <AccordionItem value="care">
        <AccordionTrigger className="text-sm font-semibold">Cake Care Instructions</AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Keep cream cakes refrigerated at 2–8°C until serving.</li>
            <li>
              Fondant cakes should be stored in a cool air-conditioned room. Refrigeration is recommended if the
              venue is warm.
            </li>
            <li>Avoid direct sunlight, excessive heat, and outdoor exposure for extended periods.</li>
            <li>
              For the best taste and texture, allow the cake to rest at room temperature for 20–30 minutes before
              serving.
            </li>
            <li>Use a clean serrated knife for smooth cutting.</li>
            <li>
              Multi-tier cakes may contain dowels, skewers, support rods, wires, or cake separators for structural
              stability. These must be removed carefully before serving. Adult supervision is recommended.
            </li>
            <li>Once assembled and displayed, avoid moving the cake unnecessarily.</li>
            <li>Consume within 24 hours of delivery for the best quality and freshness.</li>
          </ul>
          <p>✨ Thank you for choosing Cake Stories to be part of your celebration.</p>
          <div className="border-t border-border pt-3 text-xs leading-5">
            <p className="font-medium text-foreground">Manufactured &amp; Packed By</p>
            <p>Foryn Ventures LLP</p>
            <p className="mt-1 font-medium text-foreground">Production Unit:</p>
            <p>Near Esakiamman Temple, Anducode, Edaicode (P.O), Kanyakumari, Tamil Nadu – 629168</p>
            <p className="mt-1">FSSAI License No: 12425009000638</p>
            <p>Customer Care: +91 7907518447</p>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="delivery">
        <AccordionTrigger className="text-sm font-semibold">Delivery Information</AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Every cake is freshly handcrafted, so slight variations in design and appearance may occur.</li>
            <li>
              Delivery timings are approximate and may vary depending on product availability and delivery
              location.
            </li>
            <li>
              As cakes are perishable, delivery will be attempted only once and cannot be redirected to another
              address.
            </li>
            <li>This product is hand-delivered and will not be shipped with courier items.</li>
            <li>In rare cases, flavour or design substitutions may be made due to temporary or regional availability.</li>
          </ul>
          <p>For assistance, contact Customer Care: +91 7907518447</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="disclaimer" className="border-b-0">
        <AccordionTrigger className="text-sm font-semibold">Design Disclaimer</AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          The images shown are for reference and illustration purposes only. As each cake is handcrafted, slight
          variations in design, colour, decorations, flowers, toppers, and finishing may occur. We will make every
          effort to create the cake as close as possible to the selected design while ensuring the best overall
          appearance and quality.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
