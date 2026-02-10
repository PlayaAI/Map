import Link from "next/link";
import { fetchEntity } from "../../../lib/api";

interface EntityPageProps {
  params: { id: string };
}

export default async function EntityPage({ params }: EntityPageProps) {
  const entity = await fetchEntity(params.id);

  return (
    <main className="form-shell">
      <Link href="/">Back to map</Link>

      <section className="panel stack-sm" style={{ padding: 18 }}>
        <h1>{entity.name}</h1>
        <p className="meta">
          {entity.sourceType} • {entity.event.name} ({entity.event.year})
        </p>
        {entity.locationText ? <p>Location: {entity.locationText}</p> : null}
        <p>{entity.description ?? "No description available."}</p>
      </section>

      <section className="panel stack-sm" style={{ padding: 18 }}>
        <h2>AI Disclosure</h2>
        {entity.aiDisclosure ? (
          <>
            <p>
              <strong>Uses AI:</strong> {entity.aiDisclosure.usesAi ? "Yes" : "No"}
            </p>
            <p>
              <strong>Categories:</strong>{" "}
              {entity.aiDisclosure.aiCategories.length > 0
                ? entity.aiDisclosure.aiCategories.join(", ")
                : "None"}
            </p>
            <p>
              <strong>Tools:</strong>{" "}
              {entity.aiDisclosure.tools.length > 0
                ? entity.aiDisclosure.tools.join(", ")
                : "Not listed"}
            </p>
            <p>
              <strong>Human-led process:</strong>{" "}
              {entity.aiDisclosure.humanLeadDescription || "Not provided"}
            </p>
            <p>
              <strong>Tech-Free Zone:</strong> {entity.aiDisclosure.techFreeZone ? "Yes" : "No"}
            </p>
            <p>
              <strong>Disclosure text:</strong>{" "}
              {entity.aiDisclosure.disclosureText || "Not provided"}
            </p>
          </>
        ) : (
          <p>No approved AI disclosure for this listing yet.</p>
        )}
      </section>
    </main>
  );
}
