package expo.modules.nyccarousel

import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The cut-corner shape for this corner, `cut` long on each side. */
internal fun NycCutCorner.toShape(cut: Dp): CutCornerShape {
  return when (this) {
    NycCutCorner.TOP_LEFT -> CutCornerShape(topStart = cut, topEnd = 0.dp, bottomEnd = 0.dp, bottomStart = 0.dp)
    NycCutCorner.TOP_RIGHT -> CutCornerShape(topStart = 0.dp, topEnd = cut, bottomEnd = 0.dp, bottomStart = 0.dp)
    NycCutCorner.BOTTOM_RIGHT -> CutCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomEnd = cut, bottomStart = 0.dp)
    NycCutCorner.BOTTOM_LEFT -> CutCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomEnd = 0.dp, bottomStart = cut)
    NycCutCorner.ALL -> CutCornerShape(topStart = cut, topEnd = 0.dp, bottomEnd = cut, bottomStart = 0.dp)
  }
}
