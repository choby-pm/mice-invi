export function BlankScreen({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {note ?? "R0 단계: 뼈대만 있는 빈 화면입니다. 실제 기능은 다음 릴리스에서 구현합니다."}
      </p>
    </div>
  );
}
