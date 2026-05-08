// ════════════════════════════════════════════════════════════════════════════
// Modal (Dialog) · canonical re-export from components/system/Modal.jsx
//
// We export the same component under both names — `Modal` is the project's
// historical name; `Dialog` is the WAI-ARIA term used by shadcn/Radix users
// who may join the codebase.
// ════════════════════════════════════════════════════════════════════════════

import ModalImpl, { Modal, ModalFooter } from "../system/Modal"

export default ModalImpl
export { Modal, ModalFooter }
export const Dialog = Modal
export const DialogFooter = ModalFooter
