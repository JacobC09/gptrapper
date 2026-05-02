export function MatIcon({ name, size = "0.9rem" }: { name: string; size?: string }) {
    return (
        <span className="material-symbols-outlined" style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}>
            {name}
        </span>
    )
}
