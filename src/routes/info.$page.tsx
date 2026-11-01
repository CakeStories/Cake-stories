import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EditableText } from "@/components/editable";
import { findInfoPage } from "@/lib/info-pages";

export const Route = createFileRoute("/info/$page")({
  loader: ({ params }) => {
    const page = findInfoPage(params.page);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Cake Stories` },
          { name: "description", content: loaderData.intro },
        ]
      : [],
  }),
  component: InfoPageView,
});

function InfoPageView() {
  const page = Route.useLoaderData();
  const key = `info.${page.slug}`;

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <SiteHeader hideCategories />

      <article className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <EditableText id={`${key}.title`} as="h1" className="block font-display text-3xl sm:text-4xl">
          {page.title}
        </EditableText>
        <EditableText id={`${key}.intro`} as="p" multiline className="mt-3 block text-base text-muted-foreground">
          {page.intro}
        </EditableText>

        <div className="mt-8 space-y-6">
          {page.sections.map((section, i) => (
            <section key={i}>
              <EditableText id={`${key}.${i}.heading`} as="h2" className="block font-display text-xl">
                {section.heading}
              </EditableText>
              <EditableText id={`${key}.${i}.body`} as="p" multiline className="mt-1.5 block text-sm leading-6 text-foreground/80">
                {section.body}
              </EditableText>
            </section>
          ))}
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
