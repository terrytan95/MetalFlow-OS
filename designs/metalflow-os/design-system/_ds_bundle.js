/* @ds-bundle: {"format":3,"namespace":"DesignSystem_d555b8","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"MetricCard","sourcePath":"components/core/MetricCard.jsx"}],"sourceHashes":{"components/core/Button.jsx":"b2d7044b3267","components/core/MetricCard.jsx":"299cc8b43ccc"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_d555b8 = window.DesignSystem_d555b8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function Button({
  children,
  primary = false,
  disabled = false,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: primary ? 'primary' : '',
    disabled: disabled,
    onClick: onClick
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/MetricCard.jsx
try { (() => {
function MetricCard({
  label,
  value,
  note
}) {
  return /*#__PURE__*/React.createElement("article", {
    className: "card"
  }, /*#__PURE__*/React.createElement("small", null, label), /*#__PURE__*/React.createElement("strong", null, value), /*#__PURE__*/React.createElement("small", null, note));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/MetricCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.MetricCard = __ds_scope.MetricCard;

})();
