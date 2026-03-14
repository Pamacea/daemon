// Composant complexe à refactorer
interface OldComponentProps {
  data: any[];
  onAction: (item: any) => void;
  config?: any;
}

export function OldComponent({ data, onAction, config }: OldComponentProps) {
  // Complexité élevée : logique imbriquée
  const processed = data
    .filter((d) => d.active)
    .map((d) => {
      if (d.type === 'A') {
        return { ...d, value: d.x * 2 };
      } else if (d.type === 'B') {
        return { ...d, value: d.y + 10 };
      } else if (d.type === 'C') {
        if (d.subtype === 1) {
          return { ...d, value: d.z };
        } else if (d.subtype === 2) {
          return { ...d, value: d.w * 2 };
        } else {
          return { ...d, value: 0 };
        }
      } else {
        return { ...d, value: d.default };
      }
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // Autre logique complexe...
  return (
    <div>
      {processed.map((item, index) => (
        <div
          key={index}
          onClick={() => {
            if (config?.mode === 'edit') {
              onAction(item);
            } else if (config?.mode === 'delete') {
              if (confirm('Are you sure?')) {
                onAction({ ...item, deleted: true });
              }
            } else {
              onAction(item);
            }
          }}
        >
          {item.value}
        </div>
      ))}
    </div>
  );
}
