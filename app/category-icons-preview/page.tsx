import { CategoryIconsPreview } from "./category-icons-preview-client";

export const metadata = {
  title: "Category icons preview",
  robots: { index: false, follow: false },
};

export default function CategoryIconsPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-50 p-6 sm:p-10">
      <CategoryIconsPreview />
    </main>
  );
}
