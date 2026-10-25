import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CakeSlice, ChevronDown } from "lucide-react";
import { Button } from "@/components/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CakeCard } from "@/components/cake-card";
import { searchProducts } from "@/lib/search";
import { addRecentSearch } from "@/lib/recent-searches";
import { isEnquiryCategory } from "@/lib/enquiry";
import { EditableText } from "@/components/editable";
import { useEditMode } from "@/lib/edit-mode";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {},
  head: () => ({
    meta: [{ title: "Search | Cake Stories" }, { name: "robots", content: "noindex" }],
  }),
  component: SearchPage,
});

/** While editing: the sort menu's names, which can't be typed over inside the dropdown. */
function SearchSortNames() {
  const { editing } = useEditMode();
  if (!editing) return null;
  return (
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-4 pt-3 text-xs lg:px-6">
      <span className="text-muted-foreground">Sort menu names:</span>
      {["Popular", "Price: Low to High", "Price: High to Low"].map((option) => (
        <EditableText key={option} id={`sort.${option}`} className="rounded bg-muted px-2 py-0.5">
          {option}
        </EditableText>
      ))}
    </div>
  );
}

function SearchPage() {
  const { content } = useEditMode();
  const { q } = Route.useSearch();
  const query = q ?? "";
  const trimmedQuery = query.trim();
  const [sort, setSort] = useState("Popular");

  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["site-search", trimmedQuery],
    queryFn: () => searchProducts(trimmedQuery),
    enabled: trimmedQuery.length > 0,
    staleTime: 30_000,
  });

  // A landed-on search (typed + submitted, or a link with ?q=) is worth
  // remembering for the "recent searches" flyout — but only once per term,
  // not on every re-render.
  useEffect(() => {
    if (trimmedQuery) addRecentSearch(trimmedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) =>
      sort === "Price: Low to High"
        ? a.minPrice - b.minPrice
        : sort === "Price: High to Low"
          ? b.minPrice - a.minPrice
          : a.name.localeCompare(b.name),
    );
  }, [results, sort]);

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <SiteHeader defaultQuery={query} />
      <SearchSortNames />

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        {!trimmedQuery ? (
          <div className="my-16 text-center">
            <CakeSlice className="mx-auto text-muted-foreground" size={36} />
            <EditableText id="search.empty.title" as="h1" className="mt-3 block font-display text-2xl">
              Search for cakes
            </EditableText>
            <EditableText id="search.empty.text" as="p" className="mt-1 block text-sm text-muted-foreground">
              Try a flavour, an occasion, or a cake name.
            </EditableText>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-3xl">
                  <EditableText id="search.resultsFor">Results for</EditableText> "{trimmedQuery}"
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searching ? (
                    <EditableText id="search.searching">Searching…</EditableText>
                  ) : (
                    <>
                      {sortedResults.length} <EditableText id="search.matchCount">cakes match your search.</EditableText>
                    </>
                  )}
                </p>
              </div>
              <label className="relative hidden sm:block">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-10 appearance-none rounded-md border border-input bg-background pl-4 pr-9 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                >
                  {["Popular", "Price: Low to High", "Price: High to Low"].map((option) => (
                    <option key={option} value={option}>
                      {content[`sort.${option}`] ?? option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                />
              </label>
            </div>

            {sortedResults.length > 0 ? (
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {sortedResults.map((result) => (
                  <CakeCard
                    productId={result.id}
                    key={result.id}
                    href={result.href}
                    image={result.image}
                    title={result.name}
                    minPrice={result.minPrice}
                    {...(result.badge != null && { badge: result.badge })}
                    {...(result.minPriceMrp != null && { minPriceMrp: result.minPriceMrp })}
                    deliveryEstimate={result.deliveryEstimate}
                    enquiry={isEnquiryCategory(result.categorySlug)}
                  />
                ))}
              </div>
            ) : !searching ? (
              <div className="my-16 text-center">
                <CakeSlice className="mx-auto text-muted-foreground" size={36} />
                <EditableText id="search.none.title" as="h2" className="mt-3 block font-display text-2xl">
                  No cakes found
                </EditableText>
                <EditableText id="search.none.text" as="p" className="mt-1 block text-sm text-muted-foreground">
                  Try another name, or browse a category instead.
                </EditableText>
                <Button className="mt-4" asChild>
                  <Link to="/">
                    <EditableText id="category.empty.button">See all cakes</EditableText>
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
