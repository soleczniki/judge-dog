import { T } from "../theme.js";
import { Modal } from "../components/Modal.jsx";
import { Btn } from "../components/atoms.jsx";

// Shown before the review form when the user has an organiser role.
// Makes sure they're writing from their experience as a competitor,
// not from their experience as the person who hired the judge.

export function ReviewGateModal({ judgeName, isOwnerHandler, onConfirm, onClose, onAddOwnerHandler }) {
  if (!isOwnerHandler) {
    // Organiser-only account — gate them more firmly
    return (
      <Modal onClose={onClose} title="Reviews are for owners & handlers">
        <p style={{fontSize:14,color:T.textSub,lineHeight:1.7,margin:"0 0 16px"}}>
          Reviews on judge.dog are written by <strong>owners and handlers who competed under this judge</strong> — people who entered their dogs and were in the ring.
        </p>
        <p style={{fontSize:14,color:T.textSub,lineHeight:1.7,margin:"0 0 24px"}}>
          Your account is currently set up as an Event Organiser. If you also enter shows and would like to leave a review, add the Owner / Handler role to your account.
        </p>
        <Btn fullWidth onClick={onAddOwnerHandler}>Add Owner / Handler role</Btn>
        <button onClick={onClose}
          style={{display:"block",width:"100%",marginTop:10,padding:"10px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.textHint,fontFamily:"inherit"}}>
          Cancel
        </button>
      </Modal>
    );
  }

  // Has both roles — just confirm they're writing as a competitor
  return (
    <Modal onClose={onClose} title="Writing as an owner / handler">
      <p style={{fontSize:14,color:T.textSub,lineHeight:1.7,margin:"0 0 8px"}}>
        You're submitting this review as an <strong>owner or handler who competed under {judgeName}</strong> — not in your capacity as a show organiser.
      </p>
      <p style={{fontSize:13,color:T.textHint,lineHeight:1.6,margin:"0 0 24px"}}>
        Reviews should reflect your ringside experience: how the judge ran the class, evaluated your dog, and interacted with competitors.
      </p>
      <Btn fullWidth onClick={onConfirm}>Yes, I competed under this judge</Btn>
      <button onClick={onClose}
        style={{display:"block",width:"100%",marginTop:10,padding:"10px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.textHint,fontFamily:"inherit"}}>
        Cancel
      </button>
    </Modal>
  );
}
