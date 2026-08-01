// Cadre de sélection décoratif — poignées violettes reprises de la landing v3.
// À poser dans un parent `.sel` (ou `.sel .sel-block`) : l'élément a l'air
// « choisi » dans un éditeur. Purement visuel, ne capte aucun événement.
export default function SelFrame() {
  return (
    <span className="sel-frame" aria-hidden="true">
      <span className="sel-h" style={{ top: -7, left: -7 }} />
      <span className="sel-h" style={{ top: -7, right: -7 }} />
      <span className="sel-h" style={{ bottom: -7, left: -7 }} />
      <span className="sel-h" style={{ bottom: -7, right: -7 }} />
      <span className="sel-p" style={{ top: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
      <span className="sel-p" style={{ bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
      <span className="sel-p" style={{ left: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
      <span className="sel-p" style={{ right: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
    </span>
  );
}
