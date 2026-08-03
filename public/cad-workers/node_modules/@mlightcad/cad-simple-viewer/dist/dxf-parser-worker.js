var jr = [
  { name: "AC1.2", value: 1 },
  { name: "AC1.40", value: 2 },
  { name: "AC1.50", value: 3 },
  { name: "AC2.20", value: 4 },
  { name: "AC2.10", value: 5 },
  { name: "AC2.21", value: 6 },
  { name: "AC2.22", value: 7 },
  { name: "AC1001", value: 8 },
  { name: "AC1002", value: 9 },
  { name: "AC1003", value: 10 },
  { name: "AC1004", value: 11 },
  { name: "AC1005", value: 12 },
  { name: "AC1006", value: 13 },
  { name: "AC1007", value: 14 },
  { name: "AC1008", value: 15 },
  { name: "AC1009", value: 16 },
  { name: "AC1010", value: 17 },
  { name: "AC1011", value: 18 },
  { name: "AC1012", value: 19 },
  { name: "AC1013", value: 20 },
  { name: "AC1014", value: 21 },
  { name: "AC1500", value: 22 },
  { name: "AC1015", value: 23 },
  { name: "AC1800a", value: 24 },
  { name: "AC1018", value: 25 },
  { name: "AC2100a", value: 26 },
  { name: "AC1021", value: 27 },
  { name: "AC2400a", value: 28 },
  { name: "AC1024", value: 29 },
  { name: "AC1027", value: 31 },
  { name: "AC3200a", value: 32 },
  { name: "AC1032", value: 33 }
], yn = /* @__PURE__ */ (function() {
  function e(r) {
    if (typeof r == "string") {
      var a = jr.find(function(t) {
        return t.name === r;
      });
      if (!a)
        throw new Error("Unknown DWG version name: ".concat(r));
      this.name = a.name, this.value = a.value;
      return;
    }
    if (typeof r == "number") {
      var a = jr.find(function(o) {
        return o.value === r;
      });
      if (!a)
        throw new Error("Unknown DWG version value: ".concat(r));
      this.name = a.name, this.value = a.value;
      return;
    }
    throw new Error("Invalid constructor argument for AcDbDwgVersion");
  }
  return e;
})(), xn = function(e, r, a, t) {
  function o(s) {
    return s instanceof a ? s : new a(function(c) {
      c(s);
    });
  }
  return new (a || (a = Promise))(function(s, c) {
    function u(p) {
      try {
        d(t.next(p));
      } catch (b) {
        c(b);
      }
    }
    function l(p) {
      try {
        d(t.throw(p));
      } catch (b) {
        c(b);
      }
    }
    function d(p) {
      p.done ? s(p.value) : o(p.value).then(u, l);
    }
    d((t = t.apply(e, r || [])).next());
  });
}, On = function(e, r) {
  var a = { label: 0, sent: function() {
    if (s[0] & 1) throw s[1];
    return s[1];
  }, trys: [], ops: [] }, t, o, s, c;
  return c = { next: u(0), throw: u(1), return: u(2) }, typeof Symbol == "function" && (c[Symbol.iterator] = function() {
    return this;
  }), c;
  function u(d) {
    return function(p) {
      return l([d, p]);
    };
  }
  function l(d) {
    if (t) throw new TypeError("Generator is already executing.");
    for (; c && (c = 0, d[0] && (a = 0)), a; ) try {
      if (t = 1, o && (s = d[0] & 2 ? o.return : d[0] ? o.throw || ((s = o.return) && s.call(o), 0) : o.next) && !(s = s.call(o, d[1])).done) return s;
      switch (o = 0, s && (d = [d[0] & 2, s.value]), d[0]) {
        case 0:
        case 1:
          s = d;
          break;
        case 4:
          return a.label++, { value: d[1], done: !1 };
        case 5:
          a.label++, o = d[1], d = [0];
          continue;
        case 7:
          d = a.ops.pop(), a.trys.pop();
          continue;
        default:
          if (s = a.trys, !(s = s.length > 0 && s[s.length - 1]) && (d[0] === 6 || d[0] === 2)) {
            a = 0;
            continue;
          }
          if (d[0] === 3 && (!s || d[1] > s[0] && d[1] < s[3])) {
            a.label = d[1];
            break;
          }
          if (d[0] === 6 && a.label < s[1]) {
            a.label = s[1], s = d;
            break;
          }
          if (s && a.label < s[2]) {
            a.label = s[2], a.ops.push(d);
            break;
          }
          s[2] && a.ops.pop(), a.trys.pop();
          continue;
      }
      d = r.call(e, a);
    } catch (p) {
      d = [6, p], o = 0;
    } finally {
      t = s = 0;
    }
    if (d[0] & 5) throw d[1];
    return { value: d[0] ? d[1] : void 0, done: !0 };
  }
}, An = (function() {
  function e() {
    this.setupMessageHandler();
  }
  return e.prototype.setupMessageHandler = function() {
    var r = this;
    self.onmessage = function(a) {
      return xn(r, void 0, void 0, function() {
        var t, o, s, c, u;
        return On(this, function(l) {
          switch (l.label) {
            case 0:
              t = a.data, o = t.id, s = t.input, l.label = 1;
            case 1:
              return l.trys.push([1, 3, , 4]), [4, this.executeTask(s)];
            case 2:
              return c = l.sent(), this.sendResponse(o, !0, c), [3, 4];
            case 3:
              return u = l.sent(), this.sendResponse(o, !1, void 0, u instanceof Error ? u.message : String(u)), [3, 4];
            case 4:
              return [2];
          }
        });
      });
    };
  }, e.prototype.sendResponse = function(r, a, t, o, s) {
    var c = {
      id: r,
      success: a,
      data: t,
      error: o,
      errorCode: s
    };
    try {
      self.postMessage(c);
    } catch (l) {
      var u = l instanceof Error ? l.message : String(l);
      self.postMessage({
        id: r,
        success: !1,
        error: u,
        errorCode: this.classifyPostMessageError(u)
      });
    }
  }, e.prototype.classifyPostMessageError = function(r) {
    var a = r.toLowerCase();
    return a.includes("out of memory") || a.includes("data cannot be cloned") ? "worker_oom" : "worker_error";
  }, e;
})(), Fr;
(function(e) {
  e[e.UTF8 = 0] = "UTF8", e[e.US_ASCII = 1] = "US_ASCII", e[e.ISO_8859_1 = 2] = "ISO_8859_1", e[e.ISO_8859_2 = 3] = "ISO_8859_2", e[e.ISO_8859_3 = 4] = "ISO_8859_3", e[e.ISO_8859_4 = 5] = "ISO_8859_4", e[e.ISO_8859_5 = 6] = "ISO_8859_5", e[e.ISO_8859_6 = 7] = "ISO_8859_6", e[e.ISO_8859_7 = 8] = "ISO_8859_7", e[e.ISO_8859_8 = 9] = "ISO_8859_8", e[e.ISO_8859_9 = 10] = "ISO_8859_9", e[e.CP437 = 11] = "CP437", e[e.CP850 = 12] = "CP850", e[e.CP852 = 13] = "CP852", e[e.CP855 = 14] = "CP855", e[e.CP857 = 15] = "CP857", e[e.CP860 = 16] = "CP860", e[e.CP861 = 17] = "CP861", e[e.CP863 = 18] = "CP863", e[e.CP864 = 19] = "CP864", e[e.CP865 = 20] = "CP865", e[e.CP869 = 21] = "CP869", e[e.CP932 = 22] = "CP932", e[e.MACINTOSH = 23] = "MACINTOSH", e[e.BIG5 = 24] = "BIG5", e[e.CP949 = 25] = "CP949", e[e.JOHAB = 26] = "JOHAB", e[e.CP866 = 27] = "CP866", e[e.ANSI_1250 = 28] = "ANSI_1250", e[e.ANSI_1251 = 29] = "ANSI_1251", e[e.ANSI_1252 = 30] = "ANSI_1252", e[e.GB2312 = 31] = "GB2312", e[e.ANSI_1253 = 32] = "ANSI_1253", e[e.ANSI_1254 = 33] = "ANSI_1254", e[e.ANSI_1255 = 34] = "ANSI_1255", e[e.ANSI_1256 = 35] = "ANSI_1256", e[e.ANSI_1257 = 36] = "ANSI_1257", e[e.ANSI_874 = 37] = "ANSI_874", e[e.ANSI_932 = 38] = "ANSI_932", e[e.ANSI_936 = 39] = "ANSI_936", e[e.ANSI_949 = 40] = "ANSI_949", e[e.ANSI_950 = 41] = "ANSI_950", e[e.ANSI_1361 = 42] = "ANSI_1361", e[e.UTF16 = 43] = "UTF16", e[e.ANSI_1258 = 44] = "ANSI_1258", e[e.UNDEFINED = 255] = "UNDEFINED";
})(Fr || (Fr = {}));
var Tn = [
  "utf-8",
  "utf-8",
  "iso-8859-1",
  "iso-8859-2",
  "iso-8859-3",
  "iso-8859-4",
  "iso-8859-5",
  "iso-8859-6",
  "iso-8859-7",
  "iso-8859-8",
  "iso-8859-9",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "utf-8",
  "shift-jis",
  "macintosh",
  "big5",
  "utf-8",
  "utf-8",
  "ibm866",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "gbk",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "windows-1257",
  "windows-874",
  "shift-jis",
  "gbk",
  "euc-kr",
  "big5",
  "utf-8",
  "utf-16le",
  "windows-1258"
], Nn = function(e) {
  return Tn[e];
}, D, He, A, T, Ue, K, ge, ee, R, re, $, Se, ve, ye, H, ae, Ge, je, xe, Oe, We, Ye, Xe, U, ne, O, Ae, ze, I, P, Ke, B, $e, te, S, Ze, Or, Ar, qe, oe, Te, Tr, Nr, Z, Je, Ne, G, se, ie, ce, Qe, er, le, De, Ce, Dr, rr, Le, de, ke, _e, ar, C, ue, j, Cr, L, Lr, pe, W, we, nr, Me, Y, me, X, fe, kr, Fe, z;
(D = {})[D.None = 0] = "None", D[D.Anonymous = 1] = "Anonymous", D[D.NonConstant = 2] = "NonConstant", D[D.Xref = 4] = "Xref", D[D.XrefOverlay = 8] = "XrefOverlay", D[D.ExternallyDependent = 16] = "ExternallyDependent", D[D.ResolvedOrDependent = 32] = "ResolvedOrDependent", D[D.ReferencedXref = 64] = "ReferencedXref";
(He = {})[He.BYBLOCK = 0] = "BYBLOCK", He[He.BYLAYER = 256] = "BYLAYER";
(A = {})[A.Rotated = 0] = "Rotated", A[A.Aligned = 1] = "Aligned", A[A.Angular = 2] = "Angular", A[A.Diameter = 3] = "Diameter", A[A.Radius = 4] = "Radius", A[A.Angular3Point = 5] = "Angular3Point", A[A.Ordinate = 6] = "Ordinate", A[A.ReferenceIsExclusive = 32] = "ReferenceIsExclusive", A[A.IsOrdinateXTypeFlag = 64] = "IsOrdinateXTypeFlag", A[A.IsCustomTextPositionFlag = 128] = "IsCustomTextPositionFlag";
(T = {})[T.TopLeft = 1] = "TopLeft", T[T.TopCenter = 2] = "TopCenter", T[T.TopRight = 3] = "TopRight", T[T.MiddleLeft = 4] = "MiddleLeft", T[T.MiddleCenter = 5] = "MiddleCenter", T[T.MiddleRight = 6] = "MiddleRight", T[T.BottomLeft = 7] = "BottomLeft", T[T.BottomCenter = 8] = "BottomCenter", T[T.BottomRight = 9] = "BottomRight";
(Ue = {})[Ue.AtLeast = 1] = "AtLeast", Ue[Ue.Exact = 2] = "Exact";
var Wr = ((K = {})[K.Center = 0] = "Center", K[K.Above = 1] = "Above", K[K.Outside = 2] = "Outside", K[K.JIS = 3] = "JIS", K[K.Below = 4] = "Below", K);
(ge = {})[ge.WithDimension = 0] = "WithDimension", ge[ge.AddLeader = 1] = "AddLeader", ge[ge.Independent = 2] = "Independent";
(ee = {})[ee.BothOutside = 0] = "BothOutside", ee[ee.ArrowFirst = 1] = "ArrowFirst", ee[ee.TextFirst = 2] = "TextFirst", ee[ee.Auto = 3] = "Auto";
var Pe = ((R = {})[R.Feet = 0] = "Feet", R[R.None = 1] = "None", R[R.Inch = 2] = "Inch", R[R.FeetAndInch = 3] = "FeetAndInch", R[R.Leading = 4] = "Leading", R[R.Trailing = 8] = "Trailing", R[R.LeadingAndTrailing = 12] = "LeadingAndTrailing", R), Dn = ((re = {})[re.None = 0] = "None", re[re.Leading = 1] = "Leading", re[re.Trailing = 2] = "Trailing", re[re.LeadingAndTrailing = 3] = "LeadingAndTrailing", re), Cn = (($ = {})[$.Center = 0] = "Center", $[$.First = 1] = "First", $[$.Second = 2] = "Second", $[$.OverFirst = 3] = "OverFirst", $[$.OverSecond = 4] = "OverSecond", $), Ln = ((Se = {})[Se.Bottom = 0] = "Bottom", Se[Se.Center = 1] = "Center", Se[Se.Top = 2] = "Top", Se);
(ve = {})[ve.None = 0] = "None", ve[ve.UseDrawingBackground = 1] = "UseDrawingBackground", ve[ve.Custom = 2] = "Custom";
(ye = {})[ye.Horizontal = 0] = "Horizontal", ye[ye.Diagonal = 1] = "Diagonal", ye[ye.NotStacked = 2] = "NotStacked";
(H = {})[H.Scientific = 1] = "Scientific", H[H.Decimal = 2] = "Decimal", H[H.Engineering = 3] = "Engineering", H[H.Architectural = 4] = "Architectural", H[H.Fractional = 5] = "Fractional", H[H.WindowDesktop = 6] = "WindowDesktop";
(ae = {})[ae.Decimal = 0] = "Decimal", ae[ae.DegreesMinutesSecond = 1] = "DegreesMinutesSecond", ae[ae.Gradian = 2] = "Gradian", ae[ae.Radian = 3] = "Radian";
(Ge = {})[Ge.PatternFill = 0] = "PatternFill", Ge[Ge.SolidFill = 1] = "SolidFill";
(je = {})[je.NonAssociative = 0] = "NonAssociative", je[je.Associative = 1] = "Associative";
(xe = {})[xe.Normal = 0] = "Normal", xe[xe.Outer = 1] = "Outer", xe[xe.Ignore = 2] = "Ignore";
(Oe = {})[Oe.UserDefined = 0] = "UserDefined", Oe[Oe.Predefined = 1] = "Predefined", Oe[Oe.Custom = 2] = "Custom";
(We = {})[We.NotAnnotated = 0] = "NotAnnotated", We[We.Annotated = 1] = "Annotated";
(Ye = {})[Ye.Solid = 0] = "Solid", Ye[Ye.Gradient = 1] = "Gradient";
(Xe = {})[Xe.TwoColor = 0] = "TwoColor", Xe[Xe.OneColor = 1] = "OneColor";
var kn = ((U = {})[U.Default = 0] = "Default", U[U.External = 1] = "External", U[U.Polyline = 2] = "Polyline", U[U.Derived = 4] = "Derived", U[U.Textbox = 8] = "Textbox", U[U.Outermost = 16] = "Outermost", U), sr = ((ne = {})[ne.Line = 1] = "Line", ne[ne.Circular = 2] = "Circular", ne[ne.Elliptic = 3] = "Elliptic", ne[ne.Spline = 4] = "Spline", ne), _n = ((O = {})[O.Off = 0] = "Off", O[O.Solid = 1] = "Solid", O[O.Dashed = 2] = "Dashed", O[O.Dotted = 3] = "Dotted", O[O.ShotDash = 4] = "ShotDash", O[O.MediumDash = 5] = "MediumDash", O[O.LongDash = 6] = "LongDash", O[O.DoubleShortDash = 7] = "DoubleShortDash", O[O.DoubleMediumDash = 8] = "DoubleMediumDash", O[O.DoubleLongDash = 9] = "DoubleLongDash", O[O.DoubleMediumLongDash = 10] = "DoubleMediumLongDash", O[O.SparseDot = 11] = "SparseDot", O);
_n.Off;
(Ae = {})[Ae.Standard = -3] = "Standard", Ae[Ae.ByLayer = -2] = "ByLayer", Ae[Ae.ByBlock = -1] = "ByBlock";
(ze = {})[ze.English = 0] = "English", ze[ze.Metric = 1] = "Metric";
(I = {})[I.PERSPECTIVE_MODE = 1] = "PERSPECTIVE_MODE", I[I.FRONT_CLIPPING = 2] = "FRONT_CLIPPING", I[I.BACK_CLIPPING = 4] = "BACK_CLIPPING", I[I.UCS_FOLLOW = 8] = "UCS_FOLLOW", I[I.FRONT_CLIP_NOT_AT_EYE = 16] = "FRONT_CLIP_NOT_AT_EYE", I[I.UCS_ICON_VISIBILITY = 32] = "UCS_ICON_VISIBILITY", I[I.UCS_ICON_AT_ORIGIN = 64] = "UCS_ICON_AT_ORIGIN", I[I.FAST_ZOOM = 128] = "FAST_ZOOM", I[I.SNAP_MODE = 256] = "SNAP_MODE", I[I.GRID_MODE = 512] = "GRID_MODE", I[I.ISOMETRIC_SNAP_STYLE = 1024] = "ISOMETRIC_SNAP_STYLE", I[I.HIDE_PLOT_MODE = 2048] = "HIDE_PLOT_MODE", I[I.K_ISO_PAIR_TOP = 4096] = "K_ISO_PAIR_TOP", I[I.K_ISO_PAIR_RIGHT = 8192] = "K_ISO_PAIR_RIGHT", I[I.VIEWPORT_ZOOM_LOCKING = 16384] = "VIEWPORT_ZOOM_LOCKING", I[I.UNUSED = 32768] = "UNUSED", I[I.NON_RECTANGULAR_CLIPPING = 65536] = "NON_RECTANGULAR_CLIPPING", I[I.VIEWPORT_OFF = 131072] = "VIEWPORT_OFF", I[I.GRID_BEYOND_DRAWING_LIMITS = 262144] = "GRID_BEYOND_DRAWING_LIMITS", I[I.ADAPTIVE_GRID_DISPLAY = 524288] = "ADAPTIVE_GRID_DISPLAY", I[I.SUBDIVISION_BELOW_SPACING = 1048576] = "SUBDIVISION_BELOW_SPACING", I[I.GRID_FOLLOWS_WORKPLANE = 2097152] = "GRID_FOLLOWS_WORKPLANE";
(P = {})[P.OPTIMIZED_2D = 0] = "OPTIMIZED_2D", P[P.WIREFRAME = 1] = "WIREFRAME", P[P.HIDDEN_LINE = 2] = "HIDDEN_LINE", P[P.FLAT_SHADED = 3] = "FLAT_SHADED", P[P.GOURAUD_SHADED = 4] = "GOURAUD_SHADED", P[P.FLAT_SHADED_WITH_WIREFRAME = 5] = "FLAT_SHADED_WITH_WIREFRAME", P[P.GOURAUD_SHADED_WITH_WIREFRAME = 6] = "GOURAUD_SHADED_WITH_WIREFRAME";
(Ke = {})[Ke.UCS_UNCHANGED = 0] = "UCS_UNCHANGED", Ke[Ke.HAS_OWN_UCS = 1] = "HAS_OWN_UCS";
(B = {})[B.NON_ORTHOGRAPHIC = 0] = "NON_ORTHOGRAPHIC", B[B.TOP = 1] = "TOP", B[B.BOTTOM = 2] = "BOTTOM", B[B.FRONT = 3] = "FRONT", B[B.BACK = 4] = "BACK", B[B.LEFT = 5] = "LEFT", B[B.RIGHT = 6] = "RIGHT";
($e = {})[$e.ONE_DISTANT_LIGHT = 0] = "ONE_DISTANT_LIGHT", $e[$e.TWO_DISTANT_LIGHTS = 1] = "TWO_DISTANT_LIGHTS";
(te = {})[te.ByLayer = 0] = "ByLayer", te[te.ByBlock = 1] = "ByBlock", te[te.ByDictionaryDefault = 2] = "ByDictionaryDefault", te[te.ByObject = 3] = "ByObject";
(S = {})[S.NotAllowed = 0] = "NotAllowed", S[S.AllowErase = 1] = "AllowErase", S[S.AllowTransform = 2] = "AllowTransform", S[S.AllowChangeColor = 4] = "AllowChangeColor", S[S.AllowChangeLayer = 8] = "AllowChangeLayer", S[S.AllowChangeLinetype = 16] = "AllowChangeLinetype", S[S.AllowChangeLinetypeScale = 32] = "AllowChangeLinetypeScale", S[S.AllowChangeVisibility = 64] = "AllowChangeVisibility", S[S.AllowClone = 128] = "AllowClone", S[S.AllowChangeLineweight = 256] = "AllowChangeLineweight", S[S.AllowChangePlotStyleName = 512] = "AllowChangePlotStyleName", S[S.AllowAllExceptClone = 895] = "AllowAllExceptClone", S[S.AllowAll = 1023] = "AllowAll", S[S.DisableProxyWarning = 1024] = "DisableProxyWarning", S[S.R13FormatProxy = 32768] = "R13FormatProxy";
function h(e, r, a) {
  return e.code === r && (a == null || e.value === a);
}
function Ee(e) {
  let r = {};
  e.rewind();
  let a = e.next(), t = a.code;
  if (r.x = a.value, (a = e.next()).code !== t + 10) throw Error("Expected code for point value to be 20 but got " + a.code + ".");
  return r.y = a.value, (a = e.next()).code !== t + 20 ? e.rewind() : r.z = a.value, r;
}
let or = Symbol();
function m(e, r) {
  return (a, t, o) => {
    let s = (function(l, d = !1) {
      return l.reduce((p, b) => {
        b.pushContext && p.push({});
        let v = p[p.length - 1];
        for (let g of typeof b.code == "number" ? [b.code] : b.code) {
          let x = v[g] ?? (v[g] = []);
          b.isMultiple && x.length, x.push(b);
        }
        return p;
      }, [{}]);
    })(e, t.debug), c = !1, u = s.length - 1;
    for (; !h(a, 0, "EOF"); ) {
      let l = (function(N, w, V) {
        return N.find((Ve, F) => {
          var M;
          return F >= V && ((M = Ve[w]) == null ? void 0 : M.length);
        });
      })(s, a.code, u), d = l == null ? void 0 : l[a.code], p = d == null ? void 0 : d[d.length - 1];
      if (!l || !p) {
        t.rewind();
        break;
      }
      p.isMultiple || l[a.code].pop();
      let { name: b, parser: v, isMultiple: g, isReducible: x } = p, y = v == null ? void 0 : v(a, t, o);
      if (y === or) {
        t.rewind();
        break;
      }
      if (b) {
        let [N, w] = wn(o, b);
        g && !x ? (Object.prototype.hasOwnProperty.call(N, w) || (N[w] = []), N[w].push(y)) : N[w] = y;
      }
      p.pushContext && (u -= 1), c = !0, a = t.next();
    }
    return r && Object.setPrototypeOf(o, r), c;
  };
}
function wn(e, r) {
  let a = r.split(".");
  if (!a.length) throw Error("[parserGenerator::getObjectByPath] Invalid empty path");
  let t = e;
  for (let o = 0; o < a.length - 1; ++o) {
    let s = _r(a[o]), c = _r(a[o + 1]);
    Object.prototype.hasOwnProperty.call(t, s) || (typeof c == "number" ? t[s] = [] : t[s] = {}), t = t[s];
  }
  return [t, _r(a[a.length - 1])];
}
function _r(e) {
  let r = Number.parseInt(e);
  return Number.isNaN(r) ? e : r;
}
function n({ value: e }) {
  return e;
}
function i(e, r) {
  return Ee(r);
}
function f({ value: e }) {
  return !!e;
}
function Mn({ value: e }) {
  return e.trim();
}
let Fn = [{ code: 281, name: "isEntity", parser: f }, { code: 280, name: "wasProxy", parser: f }, { code: 91, name: "instanceCount", parser: n }, { code: 90, name: "proxyFlag", parser: n }, { code: 3, name: "appName", parser: n }, { code: 2, name: "cppClassName", parser: n }, { code: 1, name: "name", parser: n }], Rn = m(Fn), Pn = [{ code: 0, name: "classes", isMultiple: !0, parser(e, r) {
  if (e.value !== "CLASS") return or;
  e = r.next();
  let a = {};
  return Rn(e, r, a), a;
} }], Bn = m(Pn);
(Ze = {})[Ze.RayTrace = 0] = "RayTrace", Ze[Ze.ShadowMap = 1] = "ShadowMap";
function q(e, r, a) {
  for (; h(e, 102); ) {
    var t;
    let o = e.value;
    if (e = r.next(), !o.startsWith("{")) {
      r.debug, (function(c, u) {
        for (; !h(c, 102) && !h(c, 0, "EOF") && c.code !== 0; ) c = u.next();
      })(e, r), e = r.next();
      continue;
    }
    let s = o.slice(1).trim();
    a.extensions ?? (a.extensions = {}), (t = a.extensions)[s] ?? (t[s] = []), (function(c, u, l) {
      for (; !h(c, 102, "}") && !h(c, 0, "EOF") && c.code !== 0; ) l.push(c), c = u.next();
    })(e, r, a.extensions[s]), e = r.next();
  }
  r.rewind();
}
let Vn = [{ code: 1001, name: "xdata", isMultiple: !0, parser: Br }], Hn = /* @__PURE__ */ new Set([1010, 1011, 1012, 1013]);
function Br(e, r) {
  var o;
  if (!h(e, 1001)) throw Error("XData must starts with code 1001");
  let a = { appName: e.value, value: [] };
  e = r.next();
  let t = [a.value];
  for (; !h(e, 0, "EOF") && !h(e, 1001) && e.code >= 1e3; ) {
    let s = t[t.length - 1];
    if (e.code === 1002) {
      e.value === "{" ? t.push([]) : (t.pop(), (o = t[t.length - 1]) == null || o.push(s)), e = r.next();
      continue;
    }
    Hn.has(e.code) ? s.push(Ee(r)) : s.push(e.value), e = r.next();
  }
  return r.rewind(), a;
}
class ur {
  parseEntity(r, a) {
    let t = {}, o = "none", s = !1;
    for (; !h(a, 0, "EOF"); ) {
      switch (a.code) {
        case 100:
          a.value === "AcDbProxyEntity" && (t.subclassMarker = "AcDbProxyEntity", s = !0);
          break;
        case 90:
          t.proxyEntityClassId = a.value, o = "none";
          break;
        case 91:
          t.applicationEntityClassId = a.value, o = "none";
          break;
        case 1:
          s && (t.originalDxfName = String(a.value));
          break;
        case 92:
        case 160:
          t.graphicsDataSize = a.value, o = "graphics";
          break;
        case 93:
        case 161:
          t.entityDataSize = a.value, o = "entity";
          break;
        case 96:
        case 162:
          t.unknownDataSize = a.value, o = "unknown";
          break;
        case 310:
          o === "graphics" ? t.graphicsData = (t.graphicsData ?? "") + a.value : o === "entity" && (t.entityData = (t.entityData ?? "") + a.value);
          break;
        case 311:
          o === "unknown" && (t.unknownData = (t.unknownData ?? "") + a.value);
          break;
        case 330:
        case 340:
        case 350:
        case 360:
          o = "none", s ? (t.linkedObjectIds ?? (t.linkedObjectIds = [])).push(String(a.value)) : a.code === 330 && (t.ownerBlockRecordSoftId = String(a.value));
          break;
        case 94:
          o = "none";
          break;
        case 95:
          t.objectDrawingFormat = a.value;
          break;
        case 70:
          t.originalDataFormat = a.value;
          break;
        case 5:
          t.handle = String(a.value);
          break;
        case 102:
          q(a, r, t);
          break;
        case 67:
          t.isInPaperSpace = !!a.value;
          break;
        case 8:
          t.layer = String(a.value);
          break;
        case 6:
          t.lineType = String(a.value);
          break;
        case 347:
          t.materialObjectHardId = String(a.value);
          break;
        case 62:
          t.colorIndex = a.value;
          break;
        case 370:
          t.lineweight = a.value;
          break;
        case 48:
          t.lineTypeScale = a.value;
          break;
        case 60:
          t.isVisible = !!a.value;
          break;
        case 420:
          t.color = a.value;
          break;
        case 430:
          t.colorName = String(a.value);
          break;
        case 440:
          t.transparency = a.value;
          break;
        case 380:
          t.plotStyleType = a.value;
          break;
        case 390:
          t.plotStyleHardId = String(a.value);
          break;
        case 284:
          t.shadowMode = a.value;
          break;
        case 410:
          t.layoutTabName = String(a.value);
          break;
        case 1001:
          (t.xdata ?? (t.xdata = [])).push(Br(a, r));
          break;
        default:
          return r.rewind(), t;
      }
      a = r.next();
    }
    return r.rewind(), t;
  }
}
(Or = "ForEntityName") in ur ? Object.defineProperty(ur, Or, { value: "ACAD_PROXY_ENTITY", enumerable: !0, configurable: !0, writable: !0 }) : ur[Or] = "ACAD_PROXY_ENTITY";
(Ar = {})[Ar.ProxyEntity = 498] = "ProxyEntity";
(qe = {})[qe.Dwg = 0] = "Dwg", qe[qe.Dxf = 1] = "Dxf";
(oe = {})[oe.CAST_AND_RECEIVE = 0] = "CAST_AND_RECEIVE", oe[oe.CAST = 1] = "CAST", oe[oe.RECEIVE = 2] = "RECEIVE", oe[oe.IGNORE = 3] = "IGNORE";
let E = [...Vn, { code: 284, name: "shadowMode", parser: n }, { code: 390, name: "plotStyleHardId", parser: n }, { code: 380, name: "plotStyleType", parser: n }, { code: 440, name: "transparency", parser: n }, { code: 430, name: "colorName", parser: n }, { code: 420, name: "color", parser: n }, { code: 310, name: "proxyEntity", isMultiple: !0, isReducible: !0, parser: (e, r, a) => (a.proxyEntity ?? "") + e.value }, { code: [92, 160], name: "proxyByte", parser: n }, { code: 60, name: "isVisible", parser: f }, { code: 48, name: "lineTypeScale", parser: n }, { code: 370, name: "lineweight", parser: n }, { code: 62, name: "colorIndex", parser: n }, { code: 347, name: "materialObjectHardId", parser: n }, { code: 6, name: "lineType", parser: n }, { code: 8, name: "layer", parser: n }, { code: 410, name: "layoutTabName", parser: n }, { code: 67, name: "isInPaperSpace", parser: f }, { code: 100 }, { code: 330, name: "ownerBlockRecordSoftId", parser: n }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 5, name: "handle", parser: n }];
function Un(e) {
  return [{ code: 3, name: e, parser: (r, a, t) => (t._code3text = (t._code3text ?? "") + r.value, t._code3text + (t._code1text ?? "")), isMultiple: !0, isReducible: !0 }, { code: 1, name: e, parser: (r, a, t) => (t._code1text = r.value, (t._code3text ?? "") + t._code1text) }];
}
function Jr(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Gn = { extrusionDirection: { x: 0, y: 0, z: 1 } }, jn = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 51, name: "endAngle", parser: n }, { code: 50, name: "startAngle", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 40, name: "radius", parser: n }, { code: 10, name: "center", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100 }, ...E];
class Qr {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Jr(this, "parser", m(jn, Gn));
  }
}
Jr(Qr, "ForEntityName", "ARC");
(Te = {})[Te.BeforeText = 0] = "BeforeText", Te[Te.AboveText = 1] = "AboveText", Te[Te.None = 2] = "None";
let Vr = [{ name: "DIMPOST", code: 3 }, { name: "DIMAPOST", code: 4, defaultValue: "" }, { name: "DIMBLK_OBSOLETE", code: 5 }, { name: "DIMBLK1_OBSOLETE", code: 6 }, { name: "DIMBLK2_OBSOLETE", code: 7 }, { name: "DIMSCALE", code: 40, defaultValue: 1 }, { name: "DIMASZ", code: 41, defaultValue: 0.25 }, { name: "DIMEXO", code: 42, defaultValue: 0.625, defaultValueImperial: 0.0625 }, { name: "DIMDLI", code: 43, defaultValue: 3.75, defaultValueImperial: 0.38 }, { name: "DIMEXE", code: 44, defaultValue: 2.25, defaultValueImperial: 0.28 }, { name: "DIMRND", code: 45, defaultValue: 0 }, { name: "DIMDLE", code: 46, defaultValue: 0 }, { name: "DIMTP", code: 47, defaultValue: 0 }, { name: "DIMTM", code: 48, defaultValue: 0 }, { name: "DIMFXL", code: 49, defaultValue: 1 }, { name: "DIMJOGANG", code: 50, defaultValue: 45 }, { name: "DIMTFILL", code: 69, defaultValue: 0 }, { name: "DIMTFILLCLR", code: 70, defaultValue: 0 }, { name: "DIMTOL", code: 71, defaultValue: 0, defaultValueImperial: 1 }, { name: "DIMLIM", code: 72, defaultValue: 0 }, { name: "DIMTIH", code: 73, defaultValue: 0, defaultValueImperial: 1 }, { name: "DIMTOH", code: 74, defaultValue: 0, defaultValueImperial: 1 }, { name: "DIMSE1", code: 75, defaultValue: 0 }, { name: "DIMSE2", code: 76, defaultValue: 0 }, { name: "DIMTAD", code: 77, defaultValue: Wr.Above, defaultValueImperial: Wr.Center }, { name: "DIMZIN", code: 78, defaultValue: Pe.Trailing, defaultValueImperial: Pe.Feet }, { name: "DIMAZIN", code: 79, defaultValue: Dn.None }, { name: "DIMARCSYM", code: 90, defaultValue: 0 }, { name: "DIMTXT", code: 140, defaultValue: 2.5, defaultValueImperial: 0.28 }, { name: "DIMCEN", code: 141, defaultValue: 2.5, defaultValueImperial: 0.09 }, { name: "DIMTSZ", code: 142, defaultValue: 0 }, { name: "DIMALTF", code: 143, defaultValue: 25.4 }, { name: "DIMLFAC", code: 144, defaultValue: 1 }, { name: "DIMTVP", code: 145, defaultValue: 0 }, { name: "DIMTFAC", code: 146, defaultValue: 1 }, { name: "DIMGAP", code: 147, defaultValue: 0.625, defaultValueImperial: 0.09 }, { name: "DIMALTRND", code: 148, defaultValue: 0 }, { name: "DIMALT", code: 170, defaultValue: 0 }, { name: "DIMALTD", code: 171, defaultValue: 3, defaultValueImperial: 2 }, { name: "DIMTOFL", code: 172, defaultValue: 1, defaultValueImperial: 0 }, { name: "DIMSAH", code: 173, defaultValue: 0 }, { name: "DIMTIX", code: 174, defaultValue: 0 }, { name: "DIMSOXD", code: 175, defaultValue: 0 }, { name: "DIMCLRD", code: 176, defaultValue: 0 }, { name: "DIMCLRE", code: 177, defaultValue: 0 }, { name: "DIMCLRT", code: 178, defaultValue: 0 }, { name: "DIMADEC", code: 179, defaultValue: 0 }, { name: "DIMUNIT", code: 270 }, { name: "DIMDEC", code: 271, defaultValue: 2, defaultValueImperial: 4 }, { name: "DIMTDEC", code: 272, defaultValue: 2, defaultValueImperial: 4 }, { name: "DIMALTU", code: 273, defaultValue: 2 }, { name: "DIMALTTD", code: 274, defaultValue: 3, defaultValueImperial: 2 }, { name: "DIMAUNIT", code: 275, defaultValue: 0 }, { name: "DIMFRAC", code: 276, defaultValue: 0 }, { name: "DIMLUNIT", code: 277, defaultValue: 2 }, { name: "DIMDSEP", code: 278, defaultValue: 44, defaultValueImperial: 46 }, { name: "DIMTMOVE", code: 279, defaultValue: 0 }, { name: "DIMJUST", code: 280, defaultValue: Cn.Center }, { name: "DIMSD1", code: 281, defaultValue: 0 }, { name: "DIMSD2", code: 282, defaultValue: 0 }, { name: "DIMTOLJ", code: 283, defaultValue: Ln.Center }, { name: "DIMTZIN", code: 284, defaultValue: Pe.Trailing, defaultValueImperial: Pe.Feet }, { name: "DIMALTZ", code: 285, defaultValue: Pe.Trailing }, { name: "DIMALTTZ", code: 286, defaultValue: Pe.Trailing }, { name: "DIMFIT", code: 287 }, { name: "DIMUPT", code: 288, defaultValue: 0 }, { name: "DIMATFIT", code: 289, defaultValue: 3 }, { name: "DIMFXLON", code: 290, defaultValue: 0 }, { name: "DIMTXTDIRECTION", code: 294, defaultValue: 0 }, { name: "DIMTXSTY", code: 340, defaultValue: "Standard" }, { name: "DIMLDRBLK", code: 341, defaultValue: "" }, { name: "DIMBLK", code: 342, defaultValue: "" }, { name: "DIMBLK1", code: 343, defaultValue: "" }, { name: "DIMBLK2", code: 344, defaultValue: "" }, { name: "DIMLTYPE", code: 345, defaultValue: "" }, { name: "DIMLTEX1", code: 346, defaultValue: "" }, { name: "DIMLTEX2", code: 347, defaultValue: "" }, { name: "DIMLWD", code: 371, defaultValue: -2 }, { name: "DIMLWE", code: 372, defaultValue: -2 }], ea = [{ code: 3, name: "styleName", parser: n }, { code: 210, name: "extrusionDirection", parser: i }, { code: 51, name: "ocsRotation", parser: n }, { code: 53, name: "textRotation", parser: n }, { code: 1, name: "text", parser: n }, { code: 42, name: "measurement", parser: n }, { code: 72, name: "textLineSpacingStyle", parser: n }, { code: 71, name: "attachmentPoint", parser: n }, { code: 70, name: "dimensionType", parser: n }, { code: 11, name: "textPoint", parser: i }, { code: 10, name: "definitionPoint", parser: i }, { code: 2, name: "name", parser: n }, { code: 280, name: "version", parser: n }, { code: 100 }], Wn = [{ code: 100 }, { code: 52, name: "obliqueAngle", parser: n }, { code: 50, name: "rotationAngle", parser: n }, { code: 14, name: "subDefinitionPoint2", parser: i }, { code: 13, name: "subDefinitionPoint1", parser: i }, { code: 12, name: "insertionPoint", parser: i }, { code: 100, name: "subclassMarker", parser: n }], Yn = [{ code: 16, name: "arcPoint", parser: i }, { code: 15, name: "centerPoint", parser: i }, { code: 14, name: "subDefinitionPoint2", parser: i }, { code: 13, name: "subDefinitionPoint1", parser: i }, { code: 100, name: "subclassMarker", parser: n }], Xn = [{ code: 14, name: "subDefinitionPoint2", parser: i }, { code: 13, name: "subDefinitionPoint1", parser: i }, { code: 100, name: "subclassMarker", parser: n }], zn = [{ code: 40, name: "leaderLength", parser: n }, { code: 15, name: "subDefinitionPoint", parser: i }, { code: 100, name: "subclassMarker", parser: n }], Kn = [{ code: 100, parser(e, r, a) {
  let t = (function(o) {
    switch (o) {
      case "AcDbAlignedDimension":
        return m(Wn);
      case "AcDb3PointAngularDimension":
      case "AcDb2LineAngularDimension":
        return m(Yn);
      case "AcDbOrdinateDimension":
        return m(Xn);
      case "AcDbRadialDimension":
      case "AcDbDiametricDimension":
        return m(zn);
    }
    return null;
  })(e.value);
  if (!t) return or;
  t(e, r, a);
}, pushContext: !0 }, ...Vr.map((e) => ({ ...e, parser: n })), ...ea, ...E];
class pr {
  parseEntity(r, a) {
    let t = {};
    return m(Kn)(a, r, t), t;
  }
}
(Tr = "ForEntityName") in pr ? Object.defineProperty(pr, Tr, { value: "DIMENSION", enumerable: !0, configurable: !0, writable: !0 }) : pr[Tr] = "DIMENSION";
let $n = [{ code: 73 }, { code: 17, name: "leaderEnd", parser: i }, { code: 16, name: "leaderStart", parser: i }, { code: 71, name: "hasLeader", parser: f }, { code: 41, name: "endAngle", parser: n }, { code: 40, name: "startAngle", parser: n }, { code: 70, name: "isPartial", parser: f }, { code: 15, name: "centerPoint", parser: i }, { code: 14, name: "xline2Point", parser: i }, { code: 13, name: "xline1Point", parser: i }, { code: 100, name: "subclassMarker", parser: n, pushContext: !0 }, ...Vr.map((e) => ({ ...e, parser: n })), ...ea, ...E];
class mr {
  parseEntity(r, a) {
    let t = {};
    return m($n)(a, r, t), t;
  }
}
(Nr = "ForEntityName") in mr ? Object.defineProperty(mr, Nr, { value: "ARC_DIMENSION", enumerable: !0, configurable: !0, writable: !0 }) : mr[Nr] = "ARC_DIMENSION";
(Z = {})[Z.NONE = 0] = "NONE", Z[Z.INVISIBLE = 1] = "INVISIBLE", Z[Z.CONSTANT = 2] = "CONSTANT", Z[Z.VERIFICATION_REQUIRED = 4] = "VERIFICATION_REQUIRED", Z[Z.PRESET = 8] = "PRESET";
(Je = {})[Je.MULTILINE = 2] = "MULTILINE", Je[Je.CONSTANT_MULTILINE = 4] = "CONSTANT_MULTILINE";
(Ne = {})[Ne.NONE = 0] = "NONE", Ne[Ne.MIRRORED_X = 2] = "MIRRORED_X", Ne[Ne.MIRRORED_Y = 4] = "MIRRORED_Y";
var Zn = ((G = {})[G.LEFT = 0] = "LEFT", G[G.CENTER = 1] = "CENTER", G[G.RIGHT = 2] = "RIGHT", G[G.ALIGNED = 3] = "ALIGNED", G[G.MIDDLE = 4] = "MIDDLE", G[G.FIT = 5] = "FIT", G), qn = ((se = {})[se.BASELINE = 0] = "BASELINE", se[se.BOTTOM = 1] = "BOTTOM", se[se.MIDDLE = 2] = "MIDDLE", se[se.TOP = 3] = "TOP", se);
function ra(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let aa = { thickness: 0, rotation: 0, xScale: 1, obliqueAngle: 0, styleName: "STANDARD", generationFlag: 0, halign: Zn.LEFT, valign: qn.BASELINE, extrusionDirection: { x: 0, y: 0, z: 1 } }, na = [{ code: 73, name: "valign", parser: n }, { code: 100 }, { code: 210, name: "extrusionDirection", parser: i }, { code: 11, name: "endPoint", parser: i }, { code: 72, name: "valign", parser: n }, { code: 72, name: "halign", parser: n }, { code: 71, name: "generationFlag", parser: n }, { code: 7, name: "styleName", parser: n }, { code: 51, name: "obliqueAngle", parser: n }, { code: 41, name: "xScale", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 1, name: "text", parser: n }, { code: 40, name: "textHeight", parser: n }, { code: 10, name: "startPoint", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class ta {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    ra(this, "parser", m(na, aa));
  }
}
function oa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
ra(ta, "ForEntityName", "TEXT");
let Jn = { ...aa }, Qn = [{ code: 2 }, { code: 40, name: "annotationScale", parser: n }, { code: 10, name: "alignmentPoint", parser: i }, { code: 340, name: "secondaryAttributesHardIds", isMultiple: !0, parser: n }, { code: 70, name: "numberOfSecondaryAttributes", parser: n }, { code: 70, name: "isReallyLocked", parser: f }, { code: 70, name: "mtextFlag", parser: n }, { code: 280, name: "isDuplicatedRecord", parser: f }, { code: 100 }, { code: 280, name: "isLocked", parser: f }, { code: 74, name: "valign", parser: n }, { code: 73 }, { code: 70, name: "attributeFlag", parser: n }, { code: 2, name: "tag", parser: n }, { code: 3, name: "prompt", parser: n }, { code: 280 }, { code: 100, name: "subclassMarker", parser: n }, ...na.slice(2)];
class sa {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    oa(this, "parser", m(Qn, Jn));
  }
}
function et(e, r) {
  let a = {};
  for (let t of e) {
    let o = r(t);
    o != null && (a[o] ?? (a[o] = []), a[o].push(t));
  }
  return a;
}
function* gr(e, r = 1 / 0, a = 1) {
  for (let t = e; t !== r; t += a) yield t;
}
function Rr(e) {
  return { x: e.x ?? 0, y: e.y ?? 0, z: e.z ?? 0 };
}
oa(sa, "ForEntityName", "ATTDEF");
var rt = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 13369344, 13395558, 10027008, 10046540, 8323072, 8339263, 4980736, 4990502, 16727808, 16752511, 13382400, 13401958, 10036736, 10051404, 8331008, 8343359, 4985600, 4992806, 16744192, 16760703, 13395456, 13408614, 10046464, 10056268, 8339200, 8347455, 4990464, 4995366, 16760576, 16768895, 13408512, 13415014, 10056192, 10061132, 8347392, 8351551, 4995328, 4997670, 16776960, 16777087, 13421568, 13421670, 10000384, 10000460, 8355584, 8355647, 5000192, 5000230, 12582656, 14679935, 10079232, 11717734, 7510016, 8755276, 6258432, 7307071, 3755008, 4344870, 8388352, 12582783, 6736896, 10079334, 5019648, 7510092, 4161280, 6258495, 2509824, 3755046, 4194048, 10485631, 3394560, 8375398, 2529280, 6264908, 2064128, 5209919, 1264640, 3099686, 65280, 8388479, 52224, 6736998, 38912, 5019724, 32512, 4161343, 19456, 2509862, 65343, 8388511, 52275, 6737023, 38950, 5019743, 32543, 4161359, 19475, 2509871, 65407, 8388543, 52326, 6737049, 38988, 5019762, 32575, 4161375, 19494, 2509881, 65471, 8388575, 52377, 6737074, 39026, 5019781, 32607, 4161391, 19513, 2509890, 65535, 8388607, 52428, 6737100, 39064, 5019800, 32639, 4161407, 19532, 2509900, 49151, 8380415, 39372, 6730444, 29336, 5014936, 24447, 4157311, 14668, 2507340, 32767, 8372223, 26316, 6724044, 19608, 5010072, 16255, 4153215, 9804, 2505036, 16383, 8364031, 13260, 6717388, 9880, 5005208, 8063, 4149119, 4940, 2502476, 255, 8355839, 204, 6710988, 152, 5000344, 127, 4145023, 76, 2500172, 4129023, 10452991, 3342540, 8349388, 2490520, 6245528, 2031743, 5193599, 1245260, 3089996, 8323327, 12550143, 6684876, 10053324, 4980888, 7490712, 4128895, 6242175, 2490444, 3745356, 12517631, 14647295, 10027212, 11691724, 7471256, 8735896, 6226047, 7290751, 3735628, 4335180, 16711935, 16744447, 13369548, 13395660, 9961624, 9981080, 8323199, 8339327, 4980812, 4990540, 16711871, 16744415, 13369497, 13395634, 9961586, 9981061, 8323167, 8339311, 4980793, 4990530, 16711807, 16744383, 13369446, 13395609, 9961548, 9981042, 8323135, 8339295, 4980774, 4990521, 16711743, 16744351, 13369395, 13395583, 9961510, 9981023, 8323103, 8339279, 4980755, 4990511, 3355443, 5987163, 8684676, 11382189, 14079702, 16777215];
function at(e) {
  return rt[e];
}
function nt(e) {
  e.rewind();
  let r = e.next();
  if (r.code !== 101) throw Error("Bad call for skipEmbeddedObject()");
  do
    r = e.next();
  while (r.code !== 0);
  e.rewind();
}
function tt(e, r, a) {
  if (h(r, 102)) return q(r, a, e), !0;
  switch (r.code) {
    case 0:
      e.type = r.value;
      break;
    case 5:
      e.handle = r.value;
      break;
    case 330:
      e.ownerBlockRecordSoftId = r.value;
      break;
    case 67:
      e.isInPaperSpace = !!r.value;
      break;
    case 8:
      e.layer = r.value;
      break;
    case 6:
      e.lineType = r.value;
      break;
    case 347:
      e.materialObjectHardId = r.value;
      break;
    case 62:
      e.colorIndex = r.value, e.color = at(Math.abs(r.value));
      break;
    case 370:
      e.lineweight = r.value;
      break;
    case 48:
      e.lineTypeScale = r.value;
      break;
    case 60:
      e.isVisible = !!r.value;
      break;
    case 92:
      e.proxyByte = r.value;
      break;
    case 310:
      e.proxyEntity = r.value;
      break;
    case 100:
      break;
    case 420:
      e.color = r.value;
      break;
    case 430:
      e.transparency = r.value;
      break;
    case 390:
      e.plotStyleHardId = r.value;
      break;
    case 284:
      e.shadowMode = r.value;
      break;
    case 1001:
      (e.xdata ?? (e.xdata = [])).push(Br(r, a));
      break;
    default:
      return !1;
  }
  return !0;
}
function ia(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let ot = { textStyle: "STANDARD", extrusionDirection: { x: 0, y: 0, z: 1 }, rotation: 0 }, fr = [{ code: 46, name: "annotationHeight", parser: n }, { code: 101, parser(e, r) {
  nt(r);
} }, { code: 50, name: "columnHeight", parser: n }, { code: 49, name: "columnGutter", parser: n }, { code: 48, name: "columnWidth", parser: n }, { code: 79, name: "columnAutoHeight", parser: n }, { code: 78, name: "columnFlowReversed", parser: n }, { code: 76, name: "columnCount", parser: n }, { code: 75, name: "columnType", parser: n }, { code: 441, name: "backgroundFillTransparency", parser: n }, { code: 63, name: "backgroundFillColor", parser: n }, { code: 45, name: "fillBoxScale", parser: n }, { code: [...gr(430, 440)], name: "backgroundColor", parser: n }, { code: [...gr(420, 430)], name: "backgroundColor", parser: n }, { code: 90, name: "backgroundFill", parser: n }, { code: 44, name: "lineSpacing", parser: n }, { code: 73, name: "lineSpacingStyle", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 43 }, { code: 42 }, { code: 11, name: "direction", parser: i }, { code: 210, name: "extrusionDirection", parser: i }, { code: 7, name: "styleName", parser: n }, ...Un("text"), { code: 72, name: "drawingDirection", parser: n }, { code: 71, name: "attachmentPoint", parser: n }, { code: 41, name: "width", parser: n }, { code: 40, name: "height", parser: n }, { code: 10, name: "insertionPoint", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class ca {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    ia(this, "parser", m(fr, ot));
  }
}
function la(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
ia(ca, "ForEntityName", "MTEXT");
let st = { thickness: 0, rotation: 0, scale: 1, obliqueAngle: 0, textStyle: "STANDARD", textGenerationFlag: 0, horizontalJustification: 0, verticalJustification: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, it = [...fr.slice(fr.findIndex(({ name: e }) => e === "columnType"), fr.findIndex(({ name: e }) => e === "subclassMarker") + 1), { code: 100 }, { code: 0, parser(e) {
  if (!h(e, 0, "MTEXT")) return or;
} }, { code: 2, name: "definitionTag", parser: n }, { code: 40, name: "annotationScale", parser: n }, { code: 10, name: "alignmentPoint", parser: i }, { code: 340, name: "secondaryAttributesHardId", parser: n }, { code: 70, name: "numberOfSecondaryAttributes", parser: n }, { code: 70, name: "isReallyLocked", parser: f }, { code: 70, name: "mtextFlag", parser: n }, { code: 280, name: "isDuplicatedEntriesKeep", parser: f }, { code: 100 }, { code: 280, name: "lockPositionFlag", parser: f }, { code: 210, name: "extrusionDirection", parser: i }, { code: 11, name: "alignmentPoint", parser: i }, { code: 74, name: "verticalJustification", parser: n }, { code: 72, name: "horizontalJustification", parser: n }, { code: 71, name: "textGenerationFlag", parser: n }, { code: 7, name: "textStyle", parser: n }, { code: 51, name: "obliqueAngle", parser: n }, { code: 41, name: "scale", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 73 }, { code: 70, name: "attributeFlag", parser: n }, { code: 2, name: "tag", parser: n }, { code: 280 }, { code: 100, name: "subclassMarker", parser: n }, { code: 1, name: "text", parser: n }, { code: 40, name: "textHeight", parser: n }, { code: 10, name: "startPoint", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100 }, ...E];
class da {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    la(this, "parser", m(it, st));
  }
}
function ct(e) {
  let r = "";
  for (let a = 0; a < e.length; a++) {
    let t = e.charCodeAt(a);
    r += t <= 32 ? e[a] : String.fromCharCode(159 - t);
  }
  return r;
}
function lt(e) {
  let r = e.trimStart();
  return !(!r || /^\d/.test(r) || /^ACIS/i.test(r) || /^ASM/i.test(r) || /^(body|point|plane|cone|cylinder|sphere|torus|lump|shell|face|edge|wire|transform)\b/i.test(r) || /\b(body|point|straight-curve|ellipse-curve)\s+\$/.test(r));
}
function ua(e) {
  return e && lt(e) ? ct(e) : e;
}
function Yr(e) {
  return e.length === 0 ? "" : e.map((r) => ua(r)).join(`
`);
}
function Xr(e, r, a) {
  if (r === 1 || e.length === 0) return void e.push(a);
  e[e.length - 1] += a;
}
function dt(e) {
  return e.length === 0 ? "" : ua(e.join(""));
}
function Hr(e) {
  return [{ code: 3, name: e, parser(r, a, t) {
    let o = t._acisPayloadLines ?? (t._acisPayloadLines = []);
    return Xr(o, 3, String(r.value)), t[e] = Yr(o), t[e];
  }, isMultiple: !0, isReducible: !0 }, { code: 1, name: e, parser(r, a, t) {
    let o = t._acisPayloadLines ?? (t._acisPayloadLines = []);
    return Xr(o, 1, String(r.value)), t[e] = Yr(o), t[e];
  }, isMultiple: !0, isReducible: !0 }];
}
function pa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
la(da, "ForEntityName", "ATTRIB");
let ut = [...Hr("data"), { code: 70, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class ma {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    pa(this, "parser", m(ut));
  }
}
function fa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
pa(ma, "ForEntityName", "BODY");
let pt = { thickness: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, mt = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 40, name: "radius", parser: n }, { code: 10, name: "center", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class ba {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    fa(this, "parser", m(mt, pt));
  }
}
function ha(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
fa(ba, "ForEntityName", "CIRCLE");
let ft = { extrusionDirection: { x: 0, y: 0, z: 1 } }, bt = [{ code: 42, name: "endAngle", parser: n }, { code: 41, name: "startAngle", parser: n }, { code: 40, name: "axisRatio", parser: n }, { code: 210, name: "extrusionDirection", parser: i }, { code: 11, name: "majorAxisEndPoint", parser: i }, { code: 10, name: "center", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Ia {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    ha(this, "parser", m(bt, ft));
  }
}
function Ea(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
ha(Ia, "ForEntityName", "ELLIPSE");
let ht = [{ code: 70, name: "invisibleEdgeFlags", parser: n }, { code: 13, name: "vertices.3", parser: i }, { code: 12, name: "vertices.2", parser: i }, { code: 11, name: "vertices.1", parser: i }, { code: 10, name: "vertices.0", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class ga {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ea(this, "parser", m(ht));
  }
}
Ea(ga, "ForEntityName", "3DFACE");
(ie = {})[ie.First = 1] = "First", ie[ie.Second = 2] = "Second", ie[ie.Third = 4] = "Third", ie[ie.Fourth = 8] = "Fourth";
function tr(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
class It {
  getReadIndex() {
    return this._pointer;
  }
  getLines() {
    return this._data;
  }
  next() {
    if (!this.hasNext()) return this._eof ? this.debug : this.debug, { code: 0, value: "EOF" };
    let r = this._data[this._pointer++], a = parseInt(r, 10);
    Number.isNaN(a) && zr(r);
    let t = Pr(a, this._data[this._pointer++], this.debug), o = { code: a, value: t };
    return h(o, 0, "EOF") && (this._eof = !0), this.lastReadGroup = o, o;
  }
  peek() {
    if (!this.hasNext()) throw this._eof ? Error("Cannot call 'next' after EOF group has been read") : Error("Unexpected end of input: EOF group not read before end of file. Ended on code " + this._data[this._pointer]);
    let r = this._data[this._pointer], a = parseInt(r, 10);
    Number.isNaN(a) && zr(r);
    let t = { code: a, value: 0 };
    return t.value = Pr(t.code, this._data[this._pointer + 1], this.debug), t;
  }
  rewind(r) {
    r = r || 1, this._pointer = this._pointer - 2 * r;
  }
  hasNext() {
    return !this._eof && !(this._pointer > this._data.length - 2);
  }
  isEOF() {
    return this._eof;
  }
  constructor(r, a = !1) {
    tr(this, "_data", void 0), tr(this, "debug", void 0), tr(this, "_pointer", void 0), tr(this, "_eof", void 0), tr(this, "lastReadGroup", void 0), this._data = r, this.debug = a, this.lastReadGroup = { code: 0, value: 0 }, this._pointer = 0, this._eof = !1;
  }
}
function Pr(e, r, a = !1) {
  var t;
  let o = (t = r).endsWith("\r") ? t.slice(0, -1) : t;
  return e <= 9 ? o : e >= 10 && e <= 59 ? parseFloat(r.trim()) : e >= 60 && e <= 99 ? parseInt(r.trim()) : e >= 100 && e <= 109 ? o : e >= 110 && e <= 149 ? parseFloat(r.trim()) : e >= 160 && e <= 179 ? parseInt(r.trim()) : e >= 210 && e <= 239 ? parseFloat(r.trim()) : e >= 270 && e <= 289 ? parseInt(r.trim()) : e >= 290 && e <= 299 ? (function(s) {
    let c = s.trim().toLowerCase();
    if (c === "" || c === "0" || c === "false" || c === "f" || c === "no") return !1;
    if (c === "1" || c === "true" || c === "t" || c === "yes") return !0;
    let u = Number.parseFloat(c);
    if (!Number.isNaN(u)) return u !== 0;
    throw TypeError("String '" + s + "' cannot be cast to Boolean type");
  })(r.trim()) : e >= 300 && e <= 369 ? o : e >= 370 && e <= 389 ? parseInt(r.trim()) : e >= 390 && e <= 399 ? o : e >= 400 && e <= 409 ? parseInt(r.trim()) : e >= 410 && e <= 419 ? o : e >= 420 && e <= 429 ? parseInt(r.trim()) : e >= 430 && e <= 439 ? o : e >= 440 && e <= 459 ? parseInt(r.trim()) : e >= 460 && e <= 469 ? parseFloat(r.trim()) : e >= 470 && e <= 481 || e === 999 || e >= 1e3 && e <= 1009 ? o : e >= 1010 && e <= 1059 ? parseFloat(r.trim()) : e >= 1060 && e <= 1071 ? parseInt(r.trim()) : o;
}
function zr(e) {
  let r = e.length > 120 ? `${e.slice(0, 120)}…` : e;
  throw Error(`Invalid DXF group code line: "${r}". Expected a numeric group code (often caused by binary DXF, UTF-16-encoded DXF, or stray blank lines). Use ASCII/text DXF or remove blank lines between code/value pairs.`);
}
let Sa = [{ code: 330, name: "sourceBoundaryObjects", parser: n, isMultiple: !0 }, { code: 97, name: "numberOfSourceBoundaryObjects", parser: n }], Et = [{ code: 11, name: "end", parser: i }, { code: 10, name: "start", parser: i }], gt = [{ code: 73, name: "isCCW", parser: f }, { code: 51, name: "endAngle", parser: n }, { code: 50, name: "startAngle", parser: n }, { code: 40, name: "radius", parser: n }, { code: 10, name: "center", parser: i }], St = [{ code: 73, name: "isCCW", parser: f }, { code: 51, name: "endAngle", parser: n }, { code: 50, name: "startAngle", parser: n }, { code: 40, name: "lengthOfMinorAxis", parser: n }, { code: 11, name: "end", parser: i }, { code: 10, name: "center", parser: i }], vt = [{ code: 13, name: "endTangent", parser: i }, { code: 12, name: "startTangent", parser: i }, { code: 11, name: "fitDatum", isMultiple: !0, parser: i }, { code: 97, name: "numberOfFitData", parser: n }, { code: 10, name: "controlPoints", isMultiple: !0, parser(e, r) {
  let a = { ...Ee(r), weight: 1 };
  return (e = r.next()).code === 42 ? a.weight = e.value : r.rewind(), a;
} }, { code: 40, name: "knots", isMultiple: !0, parser: n }, { code: 96, name: "numberOfControlPoints", parser: n }, { code: 95, name: "numberOfKnots", parser: n }, { code: 74, name: "isPeriodic", parser: f }, { code: 73, name: "splineFlag", parser: n }, { code: 94, name: "degree", parser: n }], yt = { [sr.Line]: Et, [sr.Circular]: gt, [sr.Elliptic]: St, [sr.Spline]: vt }, xt = [...Sa, { code: 72, name: "edges", parser(e, r) {
  let a = { type: e.value }, t = yt[a.type];
  if (t == null) throw Error(`Unsupported HATCH boundary edge type: ${a.type} (expected 1–4: line, arc, elliptic arc, spline). This often happens when a polyline hatch boundary is parsed as edge segments (e.g. group 92 boundary flag missing the polyline bit). Try re-saving as ASCII DXF or simplifying hatch boundaries in CAD.`);
  return m(t)(e = r.next(), r, a), a;
}, isMultiple: !0 }, { code: 93, name: "numberOfEdges", parser: n }], Ot = [...Sa, { code: 10, name: "vertices", parser(e, r) {
  let a = { ...Ee(r), bulge: 0 };
  return (e = r.next()).code === 42 ? a.bulge = e.value : r.rewind(), a;
}, isMultiple: !0 }, { code: 93, name: "numberOfVertices", parser: n }, { code: 73, name: "isClosed", parser: f }, { code: 72, name: "hasBulge", parser: f }];
function At(e, r) {
  let a = { boundaryPathTypeFlag: e.value }, t = !!(a.boundaryPathTypeFlag & kn.Polyline), o = r.getReadIndex();
  return e = r.next(), !t && (function(s, c) {
    let u = Math.min(s.length, c + 120), l = c;
    for (; l < u - 1; ) {
      let d = parseInt(s[l], 10);
      if (Number.isNaN(d)) break;
      if (d === 93) {
        if (l + 3 >= s.length || parseInt(s[l + 2], 10) !== 72) return !1;
        let p = Pr(72, s[l + 3]);
        if (p === 0) return !0;
        if (p === 1) {
          if (l + 5 < s.length && parseInt(s[l + 4], 10) === 73) return !0;
          if (l + 8 < s.length && parseInt(s[l + 4], 10) === 10) {
            let b = parseInt(s[l + 8], 10);
            if (b === 10 || b === 42) return !0;
          }
        }
        break;
      }
      if (d === 0) break;
      l += 2;
    }
    return !1;
  })(r.getLines(), o) && (t = !0), t ? m(Ot)(e, r, a) : m(xt)(e, r, a), a;
}
let Tt = [{ code: 49, name: "dashLengths", parser: n, isMultiple: !0 }, { code: 79, name: "numberOfDashLengths", parser: n }, { code: 45, name: "offset", parser: Kr }, { code: 43, name: "base", parser: Kr }, { code: 53, name: "angle", parser: n }];
function Kr(e, r) {
  let a = e.code + 1, t = { x: e.value, y: 1 };
  return (e = r.next()).code === a ? t.y = e.value : r.rewind(), t;
}
function Nt(e, r) {
  let a = {};
  return m(Tt)(e, r, a), a;
}
function Dt(e, r) {
  let a = [];
  for (; e.code === 463; ) {
    let t = { reservedField: e.value };
    if ((e = r.next()).code === 63 && (t.colorIndex = e.value, e = r.next()), e.code === 421) t.rgb = e.value, a.push(t), e = r.next();
    else {
      r.rewind();
      break;
    }
  }
  return e.code !== 463 && a.length > 0 && r.rewind(), a;
}
function va(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Ct = { extrusionDirection: { x: 0, y: 0, z: 1 }, gradientRotation: 0, colorTint: 0 }, Lt = [{ code: 470, name: "gradientName", parser: n }, { code: 463, name: "gradientColors", parser: Dt }, { code: 462, name: "colorTint", parser: n }, { code: 461, name: "gradientDefinition", parser: n }, { code: 460, name: "gradientRotation", parser: n }, { code: 453, name: "numberOfColors", parser: n }, { code: 452, name: "gradientColorFlag", parser: n }, { code: 451 }, { code: 450, name: "gradientFlag", parser: n }, { code: 10, name: "seedPoints", parser: i, isMultiple: !0 }, { code: 99 }, { code: 11, name: "offsetVector", parser: i }, { code: 98, name: "numberOfSeedPoints", parser: n }, { code: 47, name: "pixelSize", parser: n }, { code: 53, name: "definitionLines", parser: Nt, isMultiple: !0 }, { code: 78, name: "numberOfDefinitionLines", parser: n }, { code: 77, name: "isDouble", parser: f }, { code: 73, name: "isAnnotated", parser: f }, { code: 41, name: "patternScale", parser: n }, { code: 52, name: "patternAngle", parser: n }, { code: 76, name: "patternType", parser: n }, { code: 75, name: "hatchStyle", parser: n }, { code: 92, name: "boundaryPaths", parser: At, isMultiple: !0 }, { code: 91, name: "numberOfBoundaryPaths", parser: n }, { code: 71, name: "associativity", parser: n }, { code: 63, name: "patternFillColor", parser: n }, { code: 70, name: "solidFill", parser: n }, { code: 2, name: "patternName", parser: n }, { code: 210, name: "extrusionDirection", parser: i }, { code: 10, name: "elevationPoint", parser: i }, { code: 100, name: "subclassMarker", parser: n, pushContext: !0 }, ...E];
class ya {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    va(this, "parser", m(Lt, Ct));
  }
}
function xa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
va(ya, "ForEntityName", "HATCH");
let kt = { brightness: 50, contrast: 50, fade: 0, clippingBoundaryPath: [] }, _t = [{ code: 290, name: "clipMode", parser: n }, { code: 14, name: "clippingBoundaryPath", isMultiple: !0, parser: i }, { code: 91, name: "countBoundaryPoints", parser: n }, { code: 71, name: "clippingBoundaryType", parser: n }, { code: 360, name: "imageDefReactorHandle", parser: n }, { code: 283, name: "fade", parser: n }, { code: 282, name: "contrast", parser: n }, { code: 281, name: "brightness", parser: n }, { code: 280, name: "isClipped", parser: f }, { code: 70, name: "flags", parser: n }, { code: 340, name: "imageDefHandle", parser: n }, { code: 13, name: "imageSize", parser: i }, { code: 12, name: "vPixel", parser: i }, { code: 11, name: "uPixel", parser: i }, { code: 10, name: "position", parser: i }, { code: 90, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Oa {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    xa(this, "parser", m(_t, kt));
  }
}
xa(Oa, "ForEntityName", "IMAGE");
(ce = {})[ce.ShowImage = 1] = "ShowImage", ce[ce.ShowImageWhenNotAlignedWithScreen = 2] = "ShowImageWhenNotAlignedWithScreen", ce[ce.UseClippingBoundary = 4] = "UseClippingBoundary", ce[ce.TransparencyIsOn = 8] = "TransparencyIsOn";
(Qe = {})[Qe.Rectangular = 1] = "Rectangular", Qe[Qe.Polygonal = 2] = "Polygonal";
(er = {})[er.Outside = 0] = "Outside", er[er.Inside = 1] = "Inside";
function Aa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let wt = { xScale: 1, yScale: 1, zScale: 1, rotation: 0, columnCount: 0, rowCount: 0, columnSpacing: 0, rowSpacing: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, Mt = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 45, name: "rowSpacing", parser: n }, { code: 44, name: "columnSpacing", parser: n }, { code: 71, name: "rowCount", parser: n }, { code: 70, name: "columnCount", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 43, name: "zScale", parser: n }, { code: 42, name: "yScale", parser: n }, { code: 41, name: "xScale", parser: n }, { code: 10, name: "insertionPoint", parser: i }, { code: 2, name: "name", parser: n }, { code: 66, name: "isVariableAttributes", parser: f }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Ta {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Aa(this, "parser", m(Mt, wt));
  }
}
function Na(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Aa(Ta, "ForEntityName", "INSERT");
let Ft = { isArrowheadEnabled: !0 }, Rt = [{ code: 213, name: "offsetFromAnnotation", parser: i }, { code: 212, name: "offsetFromBlock", parser: i }, { code: 211, name: "horizontalDirection", parser: i }, { code: 210, name: "normal", parser: i }, { code: 340, name: "associatedAnnotation", parser: n }, { code: 77, name: "byBlockColor", parser: n }, { code: 10, name: "vertices", parser: i, isMultiple: !0 }, { code: 76, name: "numberOfVertices", parser: n }, { code: 41, name: "textWidth", parser: n }, { code: 40, name: "textHeight", parser: n }, { code: 75, name: "isHooklineExists", parser: f }, { code: 74, name: "isHooklineSameDirection", parser: f }, { code: 73, name: "leaderCreationFlag", parser: n }, { code: 72, name: "isSpline", parser: f }, { code: 71, name: "isArrowheadEnabled", parser: f }, { code: 3, name: "styleName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Da {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Na(this, "parser", m(Rt, Ft));
  }
}
Na(Da, "ForEntityName", "LEADER");
(le = {})[le.TextAnnotation = 0] = "TextAnnotation", le[le.ToleranceAnnotation = 1] = "ToleranceAnnotation", le[le.BlockReferenceAnnotation = 2] = "BlockReferenceAnnotation", le[le.NoAnnotation = 3] = "NoAnnotation";
function Ca(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Pt = { thickness: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, Bt = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 11, name: "endPoint", parser: i }, { code: 10, name: "startPoint", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class La {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ca(this, "parser", m(Bt, Pt));
  }
}
function ka(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Ca(La, "ForEntityName", "LINE");
let Vt = [{ code: 280, name: "shadowMapSoftness", parser: n }, { code: 91, name: "shadowMapSize", parser: n }, { code: 73, name: "shadowType", parser: n }, { code: 293, name: "isShadowCast", parser: f }, { code: 51, name: "falloffAngle", parser: n }, { code: 50, name: "hotspotAngle", parser: n }, { code: 42, name: "limitEnd", parser: n }, { code: 41, name: "limitStart", parser: n }, { code: 292, name: "isAttenuationLimited", parser: f }, { code: 72, name: "attenuationType", parser: n }, { code: 11, name: "target", parser: i }, { code: 10, name: "position", parser: i }, { code: 40, name: "intensity", parser: n }, { code: 291, name: "isPlotGlyph", parser: f }, { code: 290, name: "isOn", parser: f }, { code: 421, name: "lightColorInstance", parser: n }, { code: 63, name: "lightColorIndex", parser: n }, { code: 70, name: "lightType", parser: n }, { code: 1, name: "name", parser: n }, { code: 90, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class _a {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    ka(this, "parser", m(Vt));
  }
}
ka(_a, "ForEntityName", "LIGHT");
(De = {})[De.Distant = 1] = "Distant", De[De.Point = 2] = "Point", De[De.Spot = 3] = "Spot";
(Ce = {})[Ce.None = 0] = "None", Ce[Ce.InverseLinear = 1] = "InverseLinear", Ce[Ce.InverseSquare = 2] = "InverseSquare";
let Ht = { flag: 0, elevation: 0, thickness: 0, extrusionDirection: { x: 0, y: 0, z: 1 }, vertices: [] }, Ut = { bulge: 0 }, Gt = [{ code: 42, name: "bulge", parser: n }, { code: 41, name: "endWidth", parser: n }, { code: 40, name: "startWidth", parser: n }, { code: 91, name: "id", parser: n }, { code: 20, name: "y", parser: n }, { code: 10, name: "x", parser: n }], jt = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 10, name: "vertices", isMultiple: !0, parser(e, r) {
  let a = {};
  return m(Gt, Ut)(e, r, a), a;
} }, { code: 39, name: "thickness", parser: n }, { code: 38, name: "elevation", parser: n }, { code: 43, name: "constantWidth", parser: n }, { code: 70, name: "flag", parser: n }, { code: 90, name: "numberOfVertices", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class br {
  parseEntity(r, a) {
    let t = {};
    return m(jt, Ht)(a, r, t), t;
  }
}
(Dr = "ForEntityName") in br ? Object.defineProperty(br, Dr, { value: "LWPOLYLINE", enumerable: !0, configurable: !0, writable: !0 }) : br[Dr] = "LWPOLYLINE";
(rr = {})[rr.IS_CLOSED = 1] = "IS_CLOSED", rr[rr.PLINE_GEN = 128] = "PLINE_GEN";
function wa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Wt = [{ code: 90, name: "overridenSubEntityCount", parser: n }, { code: 140, name: "edgeCreaseWeights", parser: n, isMultiple: !0 }, { code: 95, name: "edgeCreaseCount", parser: n }, { code: 94, parser(e, r, a) {
  a.edgeCount = e.value, a.edgeIndices = [];
  for (let t = 0; t < a.edgeCount; ++t) {
    let o = [];
    e = r.next(), o[0] = e.value, e = r.next(), o[1] = e.value, a.edgeIndices.push(o);
  }
} }, { code: 93, parser(e, r, a) {
  a.totalFaceIndices = e.value, a.faceIndices = [];
  let t = [];
  for (let s = 0; s < a.totalFaceIndices && !h(e, 0); ++s) e = r.next(), t.push(e.value);
  let o = 0;
  for (; o < t.length; ) {
    let s = t[o++], c = [];
    for (let u = 0; u < s; ++u) c.push(t[o++]);
    a.faceIndices.push(c);
  }
} }, { code: 10, name: "vertices", parser: i, isMultiple: !0 }, { code: 92, name: "verticesCount", parser: n }, { code: 91, name: "subdivisionLevel", parser: n }, { code: 40, name: "blendCrease", parser: n }, { code: 72, name: "isBlendCreased", parser: f }, { code: 71, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: Mn, pushContext: !0 }, ...E];
class Ma {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    wa(this, "parser", m(Wt));
  }
}
function Fa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
wa(Ma, "ForEntityName", "MESH");
let Yt = [{ code: 42, name: "fillParameters", parser: n, isMultiple: !0 }, { code: 75, name: "fillCount", parser: n }, { code: 41, name: "parameters", parser: n, isMultiple: !0 }, { code: 74, name: "parameterCount", parser: n }], Xt = [{ code: [74, 41, 75, 42], name: "elements", parser(e, r) {
  let a = m(Yt), t = {};
  return a(e, r, t), t;
}, isMultiple: !0 }, { code: 13, name: "miterDirection", parser: i }, { code: 12, name: "direction", parser: i }, { code: 11, name: "position", parser: i }], zt = [{ code: [11, 12, 13], name: "segments", parser(e, r) {
  let a = m(Xt), t = {};
  return a(e, r, t), t;
}, isMultiple: !0 }, { code: 210, name: "extrusionDirection", parser: i }, { code: 10, name: "startPosition", parser: i }, { code: 73, name: "styleCount", parser: n }, { code: 72, name: "vertexCount", parser: n }, { code: 71, name: "flags", parser: n }, { code: 70, name: "justification", parser: n }, { code: 40, name: "scale", parser: n }, { code: 340, name: "styleObjectHandle", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n, pushContext: !0 }, ...E];
class Ra {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Fa(this, "parser", m(zt));
  }
}
Fa(Ra, "ForEntityName", "MLINE");
(Le = {})[Le.Top = 0] = "Top", Le[Le.Zero = 1] = "Zero", Le[Le.Bottom = 2] = "Bottom";
(de = {})[de.HasVertex = 1] = "HasVertex", de[de.Closed = 2] = "Closed", de[de.SuppressStartCaps = 4] = "SuppressStartCaps", de[de.SuppressEndCaps = 8] = "SuppressEndCaps";
(ke = {})[ke.LEFT_TO_RIGHT = 1] = "LEFT_TO_RIGHT", ke[ke.TOP_TO_BOTTOM = 3] = "TOP_TO_BOTTOM", ke[ke.BY_STYLE = 5] = "BY_STYLE";
function Pa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Kt = {}, $t = [{ code: 300, parser: function(e, r, a) {
  var s;
  let t;
  if (e.value === "CONTEXT_DATA{") for (; r.hasNext(); ) {
    var o;
    if ((t = r.next()).code === 301) break;
    switch (t.code) {
      case 10:
        a.contentBasePosition = k(t, r);
        break;
      case 11:
        a.normal = k(t, r);
        break;
      case 12:
        a.textAnchor = k(t, r);
        break;
      case 13:
        a.textDirection = k(t, r);
        break;
      case 14:
        be(a).normal = k(t, r);
        break;
      case 15:
        be(a).position = k(t, r);
        break;
      case 16:
        be(a).scale = k(t, r);
        break;
      case 40:
        a.contentScale = t.value;
        break;
      case 41:
      case 44:
        a.textHeight = t.value;
        break;
      case 42:
        a.textRotation = t.value;
        break;
      case 43:
        a.textWidth = t.value;
        break;
      case 45:
        a.textLineSpacingFactor = t.value;
        break;
      case 46:
        be(a).rotation = t.value;
        break;
      case 47:
        (o = be(a)).transformationMatrix ?? (o.transformationMatrix = []), (s = be(a).transformationMatrix) == null || s.push(t.value);
        break;
      case 90:
        a.textColor = t.value;
        break;
      case 91:
        a.textBackgroundColor = t.value;
        break;
      case 92:
        a.textBackgroundTransparency = t.value;
        break;
      case 93:
        be(a).color = t.value;
        break;
      case 110:
        a.planeOrigin = k(t, r);
        break;
      case 111:
        a.planeXAxisDirection = k(t, r);
        break;
      case 112:
        a.planeYAxisDirection = k(t, r);
        break;
      case 140:
        a.arrowheadSize = t.value;
        break;
      case 141:
        a.textBackgroundScaleFactor = t.value;
        break;
      case 142:
        a.textColumnWidth = t.value;
        break;
      case 143:
        a.textColumnGutterWidth = t.value;
        break;
      case 144:
        a.textColumnHeight = t.value;
        break;
      case 145:
        a.landingGap = t.value;
        break;
      case 170:
        a.textLineSpacingStyle = t.value;
        break;
      case 171:
        a.textAttachment = t.value;
        break;
      case 172:
        a.textFlowDirection = t.value;
        break;
      case 173:
        a.textColumnType = t.value;
        break;
      case 290:
        a.hasMText = t.value;
        break;
      case 291:
        a.textBackgroundColorOn = t.value;
        break;
      case 292:
        a.textFillOn = t.value;
        break;
      case 293:
        a.textUseAutoHeight = t.value;
        break;
      case 294:
        a.textColumnFlowReversed = t.value;
        break;
      case 295:
        a.textUseWordBreak = t.value;
        break;
      case 296:
        a.hasBlock = t.value;
        break;
      case 297:
        a.planeNormalReversed = t.value;
        break;
      case 302:
        t.value === "LEADER{" && (a.leaderSections ?? (a.leaderSections = []), a.leaderSections.push((function(c, u) {
          let l, d;
          if (c.value !== "LEADER{") return { leaderLines: [] };
          let p = { leaderLines: [] };
          for (; u.hasNext(); ) {
            if ((d = u.next()).code === 303) {
              ir(p, l);
              break;
            }
            switch (d.code) {
              case 290:
                p.lastLeaderLinePointSet = d.value;
                break;
              case 291:
                p.doglegVectorSet = d.value;
                break;
              case 10:
                p.lastLeaderLinePoint = k(d, u);
                break;
              case 11:
                p.doglegVector = k(d, u);
                break;
              case 12:
                l ?? (l = {}), l.start = k(d, u);
                break;
              case 13:
                l ?? (l = {}), l.end = k(d, u), ir(p, l), l = void 0;
                break;
              case 90:
                p.leaderBranchIndex = d.value;
                break;
              case 40:
                p.doglegLength = d.value;
                break;
              case 304:
                d.value === "LEADER_LINE{" && p.leaderLines.push((function(b, v) {
                  let g, x;
                  if (b.value !== "LEADER_LINE{") return { vertices: [] };
                  let y = { vertices: [] };
                  for (; v.hasNext(); ) {
                    if ((x = v.next()).code === 305) {
                      ir(y, g);
                      break;
                    }
                    switch (x.code) {
                      case 10:
                        y.vertices.push(k(x, v));
                        break;
                      case 11:
                        g ?? (g = {}), g.start = k(x, v);
                        break;
                      case 12:
                        g ?? (g = {}), g.end = k(x, v), ir(y, g), g = void 0;
                        break;
                      case 90:
                        y.breakPointIndexes ?? (y.breakPointIndexes = []), y.breakPointIndexes.push(x.value), g ?? (g = {}), g.index = x.value;
                        break;
                      case 91:
                        y.leaderLineIndex = x.value;
                    }
                  }
                  return y;
                })(d, u));
            }
          }
          return p;
        })(t, r)));
        break;
      case 304:
        t.value !== "LEADER_LINE{" && (a.textContent = t.value, a.contentType ?? (a.contentType = 2));
        break;
      case 340:
        a.textStyleId = t.value;
        break;
      case 341:
        a.blockContentId = t.value, be(a).blockContentId = t.value;
    }
  }
} }, { code: 270, name: "version", parser: n }, { code: 340, name: "leaderStyleId", parser: n }, { code: 90, name: "propertyOverrideFlag", parser: n }, { code: 170, name: "leaderLineType", parser: n }, { code: 91, name: "leaderLineColor", parser: n }, { code: 341, name: "leaderLineTypeId", parser: n }, { code: 171, name: "leaderLineWeight", parser: n }, { code: 290, name: "landingEnabled", parser: f }, { code: 291, name: "doglegEnabled", parser: f }, { code: [40, 41], name: "doglegLength", parser: n }, { code: 342, name: "arrowheadId", parser: n }, { code: 42, name: "arrowheadSize", parser: n }, { code: 172, name: "contentType", parser: n }, { code: 343, name: "textStyleId", parser: n }, { code: 173, name: "textLeftAttachmentType", parser: n }, { code: 95, name: "textRightAttachmentType", parser: n }, { code: 174, name: "textAngleType", parser: n }, { code: 175, name: "textAlignmentType", parser: n }, { code: 92, name: "textColor", parser: n }, { code: 292, name: "textFrameEnabled", parser: f }, { code: 344, parser: function(e, r, a) {
  a.blockContentId = e.value, be(a).blockContentId = e.value;
} }, { code: 93, name: "blockContentColor", parser: n }, { code: 10, name: "blockContentScale", parser: i }, { code: 43, name: "blockContentRotation", parser: n }, { code: 176, name: "blockContentConnectionType", parser: n }, { code: 293, name: "annotativeScaleEnabled", parser: f }, { code: 94, parser: function(e, r, a) {
  a.arrowheadOverrides ?? (a.arrowheadOverrides = []), a.arrowheadOverrides.push({ index: e.value });
}, isMultiple: !0 }, { code: 345, parser: function(e, r, a) {
  var t;
  ((t = a).arrowheadOverrides ?? (t.arrowheadOverrides = []), t.arrowheadOverrides.length || t.arrowheadOverrides.push({}), t.arrowheadOverrides[t.arrowheadOverrides.length - 1]).handle = e.value;
}, isMultiple: !0 }, { code: 330, parser: function(e, r, a) {
  a.blockAttributes ?? (a.blockAttributes = []), a.blockAttributes.push({ id: e.value });
}, isMultiple: !0 }, { code: 177, parser: function(e, r, a) {
  wr(a).index = e.value;
}, isMultiple: !0 }, { code: 44, parser: function(e, r, a) {
  wr(a).width = e.value;
}, isMultiple: !0 }, { code: 302, parser: function(e, r, a) {
  wr(a).text = e.value;
}, isMultiple: !0 }, { code: 294, name: "textDirectionNegative", parser: f }, { code: 178, name: "textAlignInIPE", parser: n }, { code: 179, name: "textAttachmentPoint", parser: n }, { code: 271, name: "textAttachmentDirection", parser: n }, { code: 272, name: "bottomTextAttachmentDirection", parser: n }, { code: 273, name: "topTextAttachmentDirection", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
function k(e, r) {
  return Rr(i(e, r));
}
function ir(e, r) {
  (r != null && r.start || r != null && r.end) && (e.breaks ?? (e.breaks = []), e.breaks.push(r));
}
function be(e) {
  return e.blockContent ?? (e.blockContent = {});
}
function wr(e) {
  return e.blockAttributes ?? (e.blockAttributes = []), e.blockAttributes.length || e.blockAttributes.push({}), e.blockAttributes[e.blockAttributes.length - 1];
}
class Ba {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Pa(this, "parser", m($t, Kt));
  }
}
function Va(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Pa(Ba, "ForEntityName", "MULTILEADER");
let Zt = { data: "" }, qt = [{ code: 1 }, { code: 90, name: "dataSize", parser: n }, { code: 70, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E, { code: 310, name: "data", isMultiple: !0, isReducible: !0, parser: (e, r, a) => (a.data ?? "") + e.value }];
class Ha {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Va(this, "parser", m(qt, Zt));
  }
}
function Ua(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Va(Ha, "ForEntityName", "OLEFRAME");
let Jt = { data: "" }, Qt = [{ code: 1 }, { code: 90, name: "dataSize", parser: n }, { code: 73, name: "quality", parser: n }, { code: 72, name: "tileMode", parser: n }, { code: 71, name: "oleObjectType", parser: n }, { code: 11, name: "lowerRightCorner", parser: i }, { code: 10, name: "upperLeftCorner", parser: i }, { code: 3, name: "name", parser: n }, { code: 70, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E, { code: 310, name: "data", isMultiple: !0, isReducible: !0, parser: (e, r, a) => (a.data ?? "") + e.value }];
class Ga {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ua(this, "parser", m(Qt, Jt));
  }
}
Ua(Ga, "ForEntityName", "OLE2FRAME");
(_e = {})[_e.Link = 1] = "Link", _e[_e.Embedded = 2] = "Embedded", _e[_e.Static = 3] = "Static";
(ar = {})[ar.ModelSpace = 0] = "ModelSpace", ar[ar.PaperSpace = 1] = "PaperSpace";
function ja(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let eo = { thickness: 0, extrusionDirection: { x: 0, y: 0, z: 1 }, angle: 0 }, ro = [{ code: 50, name: "angle", parser: n }, { code: 210, name: "extrusionDirection", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 10, name: "position", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Wa {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    ja(this, "parser", m(ro, eo));
  }
}
function Ya(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
ja(Wa, "ForEntityName", "POINT");
let ao = { startWidth: 0, endWidth: 0, bulge: 0 }, no = [{ code: 91, name: "id", parser: n }, { code: [...gr(71, 75)], name: "faces", isMultiple: !0, parser: n }, { code: 50, name: "tangentDirection", parser: n }, { code: 70, name: "flag", parser: n }, { code: 42, name: "bulge", parser: n }, { code: 41, name: "endWidth", parser: n }, { code: 40, name: "startWidth", parser: n }, { code: 30, name: "z", parser: n }, { code: 20, name: "y", parser: n }, { code: 10, name: "x", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 100 }, ...E];
class Ur {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ya(this, "parser", m(no, ao));
  }
}
function Xa(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Ya(Ur, "ForEntityName", "VERTEX");
let to = { thickness: 0, flag: 0, startWidth: 0, endWidth: 0, meshMVertexCount: 0, meshNVertexCount: 0, surfaceMDensity: 0, surfaceNDensity: 0, smoothType: 0, extrusionDirection: { x: 0, y: 0, z: 1 }, vertices: [] }, oo = [{ code: 0, name: "vertices", isMultiple: !0, parser: (e, r) => h(e, 0, "VERTEX") ? (e = r.next(), new Ur().parseEntity(r, e)) : or }, { code: 210, name: "extrusionDirection", parser: i }, { code: 75, name: "smoothType", parser: n }, { code: 74, name: "surfaceNDensity", parser: n }, { code: 73, name: "surfaceMDensity", parser: n }, { code: 72, name: "meshNVertexCount", parser: n }, { code: 71, name: "meshMVertexCount", parser: n }, { code: 41, name: "endWidth", parser: n }, { code: 40, name: "startWidth", parser: n }, { code: 70, name: "flag", parser: n }, { code: 39, name: "thickness", parser: n }, { code: 30, name: "elevation", parser: n }, { code: 20 }, { code: 10 }, { code: 66 }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class za {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Xa(this, "parser", m(oo, to));
  }
}
Xa(za, "ForEntityName", "POLYLINE");
(C = {})[C.CLOSED_POLYLINE = 1] = "CLOSED_POLYLINE", C[C.CURVE_FIT = 2] = "CURVE_FIT", C[C.SPLINE_FIT = 4] = "SPLINE_FIT", C[C.POLYLINE_3D = 8] = "POLYLINE_3D", C[C.POLYGON_3D = 16] = "POLYGON_3D", C[C.CLOSED_POLYGON = 32] = "CLOSED_POLYGON", C[C.POLYFACE = 64] = "POLYFACE", C[C.CONTINUOUS = 128] = "CONTINUOUS";
(ue = {})[ue.NONE = 0] = "NONE", ue[ue.QUADRATIC = 5] = "QUADRATIC", ue[ue.CUBIC = 6] = "CUBIC", ue[ue.BEZIER = 8] = "BEZIER";
function Ka(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let so = [{ code: 11, name: "direction", parser: i }, { code: 10, name: "position", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class $a {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ka(this, "parser", m(so));
  }
}
function Za(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Ka($a, "ForEntityName", "RAY");
let io = [...Hr("data"), { code: 70, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class qa {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Za(this, "parser", m(io));
  }
}
function Ja(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Za(qa, "ForEntityName", "REGION");
let co = { vertices: [], backLineVertices: [] }, lo = [{ code: 360, name: "geometrySettingHardId", parser: n }, { code: 12, name: "backLineVertices", isMultiple: !0, parser: i }, { code: 93, name: "numberOfBackLineVertices", parser: n }, { code: 11, name: "vertices", isMultiple: !0, parser: i }, { code: 92, name: "verticesCount", parser: n }, { code: [63, 411], name: "indicatorColor", parser: n }, { code: 70, name: "indicatorTransparency", parser: n }, { code: 41, name: "bottomHeight", parser: n }, { code: 40, name: "topHeight", parser: n }, { code: 10, name: "verticalDirection", parser: i }, { code: 1, name: "name", parser: n }, { code: 91, name: "flag", parser: n }, { code: 90, name: "state", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class Qa {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    Ja(this, "parser", m(lo, co));
  }
}
function en(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
Ja(Qa, "ForEntityName", "SECTION");
let uo = { thickness: 0, rotation: 0, xScale: 1, obliqueAngle: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, po = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 51, name: "obliqueAngle", parser: n }, { code: 41, name: "xScale", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 2, name: "shapeName", parser: n }, { code: 40, name: "size", parser: n }, { code: 10, name: "insertionPoint", parser: i }, { code: 39, name: "thickness", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class rn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    en(this, "parser", m(po, uo));
  }
}
function an(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
en(rn, "ForEntityName", "SHAPE");
let mo = { points: [], thickness: 0, extrusionDirection: { x: 0, y: 0, z: 1 } }, fo = [{ code: 210, name: "extrusionDirection", parser: i }, { code: 39, name: "thickness", parser: n }, { code: [...gr(10, 14)], name: "points", isMultiple: !0, parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class nn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    an(this, "parser", m(fo, mo));
  }
}
function tn(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
an(nn, "ForEntityName", "SOLID");
let bo = [{ code: 350, name: "historyObjectSoftId", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 2, name: "guid", parser: n }, { code: 290, name: "satCache", parser: n }, ...Hr("data"), { code: 70, name: "version", parser: n }, { code: 100 }, ...E];
class on {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    tn(this, "parser", m(bo));
  }
}
function sn(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
tn(on, "ForEntityName", "3DSOLID");
let ho = { knotTolerance: 1e-6, controlTolerance: 1e-6, fitTolerance: 1e-9, knotValues: [], controlPoints: [], fitPoints: [] }, Io = [{ code: 11, name: "fitPoints", isMultiple: !0, parser: i }, { code: 10, name: "controlPoints", isMultiple: !0, parser: i }, { code: 41, name: "weights", isMultiple: !0, parser: n }, { code: 40, name: "knots", isMultiple: !0, parser: n }, { code: 13, name: "endTangent", parser: i }, { code: 12, name: "startTangent", parser: i }, { code: 44, name: "fitTolerance", parser: n }, { code: 43, name: "controlTolerance", parser: n }, { code: 42, name: "knotTolerance", parser: n }, { code: 74, name: "numberOfFitPoints", parser: n }, { code: 73, name: "numberOfControlPoints", parser: n }, { code: 72, name: "numberOfKnots", parser: n }, { code: 71, name: "degree", parser: n }, { code: 70, name: "flag", parser: n }, { code: 210, name: "normal", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class cn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    sn(this, "parser", m(Io, ho));
  }
}
sn(cn, "ForEntityName", "SPLINE");
(j = {})[j.NONE = 0] = "NONE", j[j.CLOSED = 1] = "CLOSED", j[j.PERIODIC = 2] = "PERIODIC", j[j.RATIONAL = 4] = "RATIONAL", j[j.PLANAR = 8] = "PLANAR", j[j.LINEAR = 16] = "LINEAR";
function ln(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let Eo = [{ code: 280, name: "shadowMapSoftness", parser: n }, { code: 71, name: "shadowMapSize", parser: n }, { code: 70, name: "shadowType", parser: n }, { code: 292, name: "isSummerTime", parser: f }, { code: 92, name: "time", parser: n }, { code: 91, name: "julianDay", parser: n }, { code: 291, name: "hasShadow", parser: f }, { code: 40, name: "intensity", parser: n }, { code: 421, name: "lightColorInstance", parser: n }, { code: 63, name: "lightColorIndex", parser: n }, { code: 290, name: "isOn", parser: f }, { code: 90, name: "version", parser: n }, { code: 100, name: "subclassMarker", parser: n, pushContext: !0 }, ...E.filter((e) => e.code !== 100)];
class dn {
  parseEntity(r, a) {
    let t = { layer: "" };
    return this.parser(a, r, t), t;
  }
  constructor() {
    ln(this, "parser", m(Eo));
  }
}
ln(dn, "ForEntityName", "SUN");
class hr {
  parseEntity(r, a) {
    let t = {};
    for (; !r.isEOF(); ) {
      if (a.code === 0) {
        r.rewind();
        break;
      }
      switch (a.code) {
        case 100:
          t.subclassMarker = a.value, a = r.next();
          break;
        case 2:
          t.name = a.value, a = r.next();
          break;
        case 5:
          t.handle = a.value, a = r.next();
          break;
        case 10:
          t.startPoint = Rr(Ee(r)), a = r.lastReadGroup;
          break;
        case 11:
          t.directionVector = Rr(Ee(r)), a = r.lastReadGroup;
          break;
        case 90:
          t.tableValue = a.value, a = r.next();
          break;
        case 91:
          t.rowCount = a.value, a = r.next();
          break;
        case 92:
          t.columnCount = a.value, a = r.next();
          break;
        case 93:
          t.overrideFlag = a.value, a = r.next();
          break;
        case 94:
          t.borderColorOverrideFlag = a.value, a = r.next();
          break;
        case 95:
          t.borderLineWeightOverrideFlag = a.value, a = r.next();
          break;
        case 96:
          t.borderVisibilityOverrideFlag = a.value, a = r.next();
          break;
        case 141:
          t.rowHeightArr ?? (t.rowHeightArr = []), t.rowHeightArr.push(a.value), a = r.next();
          break;
        case 142:
          t.columnWidthArr ?? (t.columnWidthArr = []), t.columnWidthArr.push(a.value), a = r.next();
          break;
        case 280:
          t.version = a.value, a = r.next();
          break;
        case 310:
          t.bmpPreview ?? (t.bmpPreview = ""), t.bmpPreview += a.value, a = r.next();
          break;
        case 330:
          t.ownerBlockRecordSoftId = a.value, a = r.next();
          break;
        case 342:
          t.tableStyleId = a.value, a = r.next();
          break;
        case 343:
          t.blockRecordHandle = a.value, a = r.next();
          break;
        case 170:
          t.attachmentPoint = a.value, a = r.next();
          break;
        case 171:
          t.cells ?? (t.cells = []), t.cells.push((function(o, s) {
            let c = !1, u = !1, l = {};
            for (; !o.isEOF() && s.code !== 0 && !u; ) switch (s.code) {
              case 171:
                if (c) {
                  u = !0;
                  continue;
                }
                l.cellType = s.value, c = !0, s = o.next();
                break;
              case 172:
                l.flagValue = s.value, s = o.next();
                break;
              case 173:
                l.mergedValue = s.value, s = o.next();
                break;
              case 174:
                l.autoFit = s.value, s = o.next();
                break;
              case 175:
                l.borderWidth = s.value, s = o.next();
                break;
              case 176:
                l.borderHeight = s.value, s = o.next();
                break;
              case 91:
                l.overrideFlag = s.value, s = o.next();
                break;
              case 178:
                l.virtualEdgeFlag = s.value, s = o.next();
                break;
              case 145:
                l.rotation = s.value, s = o.next();
                break;
              case 345:
                l.fieldObjetId = s.value, s = o.next();
                break;
              case 340:
                l.blockTableRecordId = s.value, s = o.next();
                break;
              case 146:
                l.blockScale = s.value, s = o.next();
                break;
              case 177:
                l.blockAttrNum = s.value, s = o.next();
                break;
              case 7:
                l.textStyle = s.value, s = o.next();
                break;
              case 140:
                l.textHeight = s.value, s = o.next();
                break;
              case 170:
                l.attachmentPoint = s.value, s = o.next();
                break;
              case 92:
                l.extendedCellFlags = s.value, s = o.next();
                break;
              case 285:
                l.rightBorderVisibility = !!(s.value ?? !0), s = o.next();
                break;
              case 286:
                l.bottomBorderVisibility = !!(s.value ?? !0), s = o.next();
                break;
              case 288:
                l.leftBorderVisibility = !!(s.value ?? !0), s = o.next();
                break;
              case 289:
                l.topBorderVisibility = !!(s.value ?? !0), s = o.next();
                break;
              case 301:
                (function(d, p, b) {
                  for (; b.code !== 304; ) switch (b.code) {
                    case 301:
                    case 93:
                    case 90:
                    case 94:
                      b = p.next();
                      break;
                    case 1:
                      d.text = b.value, b = p.next();
                      break;
                    case 300:
                      d.attrText = b.value, b = p.next();
                      break;
                    case 302:
                      d.text = b.value ? b.value : d.text, b = p.next();
                      break;
                    default:
                      p.debug, b = p.next();
                  }
                })(l, o, s), s = o.next();
                break;
              default:
                return l;
            }
            return c = !1, u = !1, l;
          })(r, a)), a = r.lastReadGroup;
          break;
        default:
          tt(t, a, r), a = r.next();
      }
    }
    return t;
  }
}
function un(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
(Cr = "ForEntityName") in hr ? Object.defineProperty(hr, Cr, { value: "ACAD_TABLE", enumerable: !0, configurable: !0, writable: !0 }) : hr[Cr] = "ACAD_TABLE";
let go = [{ code: 11, name: "xAxisDirection", parser: i }, { code: 210, name: "extrusionDirection", parser: i }, { code: 1, name: "text", parser: n }, { code: 10, name: "position", parser: i }, { code: 3, name: "styleName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class pn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    un(this, "parser", m(go));
  }
}
un(pn, "ForEntityName", "TOLERANCE");
(L = {})[L.CREATED_BY_CURVE_FIT = 1] = "CREATED_BY_CURVE_FIT", L[L.TANGENT_DEFINED = 2] = "TANGENT_DEFINED", L[L.NOT_USED = 4] = "NOT_USED", L[L.CREATED_BY_SPLINE_FIT = 8] = "CREATED_BY_SPLINE_FIT", L[L.SPLINE_CONTROL_POINT = 16] = "SPLINE_CONTROL_POINT", L[L.FOR_POLYLINE = 32] = "FOR_POLYLINE", L[L.FOR_POLYGON = 64] = "FOR_POLYGON", L[L.POLYFACE = 128] = "POLYFACE";
let So = [{ code: [335, 343, 344, 91], name: "softPointers", isMultiple: !0, parser: n }, { code: 361, name: "sunId", parser: n }, { code: 431, name: "ambientLightColorName", parser: n }, { code: 421, name: "ambientLightColorInstance", parser: n }, { code: 63, name: "ambientLightColorIndex", parser: n }, { code: 142, name: "contrast", parser: n }, { code: 141, name: "brightness", parser: n }, { code: 282, name: "defaultLightingType", parser: n }, { code: 292, name: "isDefaultLighting", parser: f }, { code: 348, name: "visualStyleId", parser: n }, { code: 333, name: "shadePlotId", parser: n }, { code: 332, name: "backgroundId", parser: n }, { code: 61, name: "majorGridFrequency", parser: n }, { code: 170, name: "shadePlotMode", parser: n }, { code: 146, name: "elevation", parser: n }, { code: 79, name: "orthographicType", parser: n }, { code: 346, name: "ucsBaseId", parser: n }, { code: 345, name: "ucsId", parser: n }, { code: 112, name: "ucsYAxis", parser: i }, { code: 111, name: "ucsXAxis", parser: i }, { code: 110, name: "ucsOrigin", parser: i }, { code: 74, name: "iconFlag", parser: n }, { code: 71, name: "ucsPerViewport", parser: n }, { code: 281, name: "renderMode", parser: n }, { code: 1, name: "sheetName", parser: n }, { code: 340, name: "clippingBoundaryId", parser: n }, { code: 90, name: "statusBitFlags", parser: n }, { code: 331, name: "frozenLayerIds", isMultiple: !0, parser: n }, { code: 72, name: "circleZoomPercent", parser: n }, { code: 51, name: "viewTwistAngle", parser: n }, { code: 50, name: "snapAngle", parser: n }, { code: 45, name: "viewHeight", parser: n }, { code: 44, name: "backClipZ", parser: n }, { code: 43, name: "frontClipZ", parser: n }, { code: 42, name: "perspectiveLensLength", parser: n }, { code: 17, name: "targetPoint", parser: i }, { code: 16, name: "viewDirection", parser: i }, { code: 15, name: "gridSpacing", parser: i }, { code: 14, name: "snapSpacing", parser: i }, { code: 13, name: "snapBase", parser: i }, { code: 12, name: "displayCenter", parser: i }, { code: 69, name: "viewportId", parser: n }, { code: 68, name: "status", parser: n }, { code: 41, name: "height", parser: n }, { code: 40, name: "width", parser: n }, { code: 10, name: "viewportCenter", parser: i }, { code: 100, name: "subclassMarker", parser: n, pushContext: !0 }, ...E];
class Ir {
  parseEntity(r, a) {
    let t = {};
    return m(So)(a, r, t), t;
  }
}
function mn(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
(Lr = "ForEntityName") in Ir ? Object.defineProperty(Ir, Lr, { value: "VIEWPORT", enumerable: !0, configurable: !0, writable: !0 }) : Ir[Lr] = "VIEWPORT";
let vo = { brightness: 50, constrast: 50, fade: 0 }, yo = [{ code: 14, name: "boundary", isMultiple: !0, parser: i }, { code: 91, name: "numberOfVertices", parser: n }, { code: 71, name: "boundaryType", parser: n }, { code: 360, name: "imageDefReactorHardId", parser: n }, { code: 283, name: "fade", parser: n }, { code: 282, name: "contrast", parser: n }, { code: 281, name: "brightness", parser: n }, { code: 280, name: "isClipping", parser: f }, { code: 70, name: "displayFlag", parser: n }, { code: 340, name: "imageDefHardId", parser: n }, { code: 13, name: "imageSize", parser: i }, { code: 12, name: "vDirection", parser: i }, { code: 11, name: "uDirection", parser: i }, { code: 10, name: "position", parser: i }, { code: 90, name: "classVersion", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class fn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    mn(this, "parser", m(yo, vo));
  }
}
mn(fn, "ForEntityName", "WIPEOUT");
(pe = {})[pe.ShowImage = 1] = "ShowImage", pe[pe.ShowImageWhenNotAligned = 2] = "ShowImageWhenNotAligned", pe[pe.UseClippingBoundary = 4] = "UseClippingBoundary", pe[pe.Transparency = 8] = "Transparency";
function bn(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
let xo = [{ code: 11, name: "direction", parser: i }, { code: 10, name: "position", parser: i }, { code: 100, name: "subclassMarker", parser: n }, ...E];
class hn {
  parseEntity(r, a) {
    let t = {};
    return this.parser(a, r, t), t;
  }
  constructor() {
    bn(this, "parser", m(xo));
  }
}
bn(hn, "ForEntityName", "XLINE");
let Oo = 0;
function In(e) {
  if (!e) throw TypeError("entity cannot be undefined or null");
  e.handle || (e.handle = Oo++);
}
let Ao = Object.fromEntries([ur, Qr, mr, sa, da, ma, ba, pr, Ia, ga, Oa, Ta, Da, La, _a, br, Ma, Ra, ca, Ba, Ha, Ga, Wa, za, $a, qa, Qa, rn, nn, on, cn, dn, hr, ta, pn, ya, Ur, Ir, fn, hn].map((e) => [e.ForEntityName, new e()]));
function En(e, r) {
  let a = [];
  for (; !h(e, 0, "EOF"); ) {
    if (e.code === 0) {
      if (e.value === "ENDBLK" || e.value === "ENDSEC") {
        r.rewind();
        break;
      }
      let t = Ao[e.value];
      if (t) {
        let o = e.value;
        e = r.next();
        let s = t.parseEntity(r, e);
        s.type = o, In(s), a.push(s);
      } else r.debug;
    }
    e = r.next();
  }
  return a;
}
function To(e, r) {
  let a = null, t = {};
  for (; !h(e, 0, "EOF") && !h(e, 0, "ENDSEC"); ) e.code === 9 ? a = typeof e.value == "string" ? e.value : null : a != null && (e.code === 10 ? t[a] = Ee(r) : t[a] = e.value), e = r.next();
  return t;
}
let he = [{ code: 100, name: "subclassMarker", parser: n }, { code: 330, name: "ownerObjectId", parser: n }, { code: 102, isMultiple: !0, parser(e, r) {
  for (; !h(e, 0, "EOF") && !h(e, 102, "}"); ) e = r.next();
} }, { code: 5, name: "handle", parser: n }], No = [{ code: 70, name: "flag", parser: n }, { code: 2, name: "appName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he], Do = m(No), Co = m([{ code: 310, name: "bmpPreview", isMultiple: !0, isReducible: !0, parser: (e, r, a) => (a.bmpPreview ?? "") + e.value }, { code: 281, name: "scalability", parser: n }, { code: 280, name: "explodability", parser: n }, { code: 70, name: "insertionUnits", parser: n }, { code: 340, name: "layoutObjects", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he]), Lo = m([...Vr.map((e) => ({ ...e, parser: n })), { code: 70, name: "standardFlag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 105, name: "handle", parser: n }, ...he.filter((e) => e.code !== 5)]), ko = m([{ code: 347, name: "materialObjectId", parser: n }, { code: 390, name: "plotStyleNameObjectId", parser: n }, { code: 370, name: "lineweight", parser: n }, { code: 290, name: "isPlotting", parser: f }, { code: 6, name: "lineType", parser: n }, { code: 62, name: "colorIndex", parser: n }, { code: 70, name: "standardFlag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he]), _o = m([{ code: 9, name: "text", parser: n }, { code: 45, name: "offsetY", parser: n }, { code: 44, name: "offsetX", parser: n }, { code: 50, name: "rotation", parser: n }, { code: 46, name: "scale", parser: n }, { code: 340, name: "styleObjectId", parser: n }, { code: 75, name: "shapeNumber", parser: n }, { code: 74, name: "elementTypeFlag", parser: n }, { code: 49, name: "elementLength", parser: n }], { elementTypeFlag: 0, elementLength: 0 }), wo = m([{ code: 49, name: "pattern", parser(e, r) {
  let a = {};
  return _o(e, r, a), a;
}, isMultiple: !0 }, { code: 40, name: "totalPatternLength", parser: n }, { code: 73, name: "numberOfLineTypes", parser: n }, { code: 72, parser: n }, { code: 3, name: "description", parser: n }, { code: 70, name: "standardFlag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he]), Mo = m([{ code: 1e3, name: "extendedFont", parser: n }, { code: 1001 }, { code: 4, name: "bigFont", parser: n }, { code: 3, name: "font", parser: n }, { code: 42, name: "lastHeight", parser: n }, { code: 71, name: "textGenerationFlag", parser: n }, { code: 50, name: "obliqueAngle", parser: n }, { code: 41, name: "widthFactor", parser: n }, { code: 40, name: "fixedTextHeight", parser: n }, { code: 70, name: "standardFlag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he]), Fo = [{ code: 13, name: "orthographicOrigin", parser: i }, { code: 71, name: "orthographicType", parser: n }, { code: 346, name: "baseUcsHandle", parser: n }, { code: 146, name: "elevation", parser: n }, { code: 79, name: "isOrthographic", parser: f }, { code: 12, name: "yAxis", parser: i }, { code: 11, name: "xAxis", parser: i }, { code: 10, name: "origin", parser: i }, { code: 70, name: "flag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he], Ro = m(Fo), Po = [{ code: 346, name: "baseUcsId", parser: n }, { code: 345, name: "ucsId", parser: n }, { code: 146, name: "elevation", parser: n }, { code: 79, name: "orthographicType", parser: n }, { code: 112, name: "ucsYAxis", parser: i }, { code: 111, name: "ucsXAxis", parser: i }, { code: 110, name: "ucsOrigin", parser: i }, { code: 361, name: "sunHardId", parser: n }, { code: 348, name: "styleHardId", parser: n }, { code: 334, name: "liveSectionSoftId", parser: n }, { code: 332, name: "backgroundSoftId", parser: n }, { code: 73, name: "isPlottable", parser: f }, { code: 72, name: "isUcsAssociated", parser: f }, { code: 281, name: "renderMode", parser: n }, { code: 71, name: "viewMode", parser: n }, { code: 50, name: "twistAngle", parser: n }, { code: 44, name: "backClippingPlane", parser: n }, { code: 43, name: "frontClippingPlane", parser: n }, { code: 42, name: "lensLength", parser: n }, { code: 12, name: "target", parser: i }, { code: 11, name: "direction", parser: i }, { code: 10, name: "center", parser: i }, { code: 41, name: "width", parser: n }, { code: 40, name: "height", parser: n }, { code: 70, name: "flag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he], Bo = m(Po), Vo = m([{ code: [63, 421, 431], name: "ambientColor", parser: n }, { code: 142, name: "contrast", parser: n }, { code: 141, name: "brightness", parser: n }, { code: 282, name: "defaultLightingType", parser: n }, { code: 292, name: "isDefaultLightingOn", parser: f }, { code: 348, name: "visualStyleObjectId", parser: n }, { code: 333, name: "shadePlotObjectId", parser: n }, { code: 332, name: "backgroundObjectId", parser: n }, { code: 61, name: "majorGridLines", parser: n }, { code: 170, name: "shadePlotSetting", parser: n }, { code: 146, name: "elevation", parser: n }, { code: 79, name: "orthographicType", parser: n }, { code: 112, name: "ucsYAxis", parser: i }, { code: 111, name: "ucsXAxis", parser: i }, { code: 110, name: "ucsOrigin", parser: i }, { code: 74, name: "ucsIconSetting", parser: n }, { code: 71, name: "viewMode", parser: n }, { code: 281, name: "renderMode", parser: n }, { code: 1, name: "styleSheet", parser: n }, { code: [331, 441], name: "frozenLayers", parser: n, isMultiple: !0 }, { code: 72, name: "circleSides", parser: n }, { code: 51, name: "viewTwistAngle", parser: n }, { code: 50, name: "snapRotationAngle", parser: n }, { code: 45, name: "viewHeight", parser: n }, { code: 44, name: "backClippingPlane", parser: n }, { code: 43, name: "frontClippingPlane", parser: n }, { code: 42, name: "lensLength", parser: n }, { code: 41, name: "aspectRatio", parser: n }, { code: 40, name: "viewHeight", parser: n }, { code: 17, name: "viewTarget", parser: i }, { code: 16, name: "viewDirectionFromTarget", parser: i }, { code: 15, name: "gridSpacing", parser: i }, { code: 14, name: "snapSpacing", parser: i }, { code: 13, name: "snapBasePoint", parser: i }, { code: 12, name: "center", parser: i }, { code: 11, name: "upperRightCorner", parser: i }, { code: 10, name: "lowerLeftCorner", parser: i }, { code: 70, name: "standardFlag", parser: n }, { code: 2, name: "name", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...he]), Ho = { APPID: Do, BLOCK_RECORD: Co, DIMSTYLE: Lo, LAYER: ko, LTYPE: wo, STYLE: Mo, UCS: Ro, VIEW: Bo, VPORT: Vo }, Uo = m([{ code: 70, name: "maxNumberOfEntries", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 330, name: "ownerObjectId", parser: n }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 360, isMultiple: !0 }, { code: 5, name: "handle", parser: n }, { code: 2, name: "name", parser: n }]);
function Go(e, r) {
  var t;
  let a = {};
  for (; !h(e, 0, "EOF") && !h(e, 0, "ENDSEC"); ) {
    if (h(e, 0, "TABLE")) {
      e = r.next();
      let o = { entries: [] };
      Uo(e, r, o), a[o.name] = o;
    }
    if (h(e, 0) && !h(e, 0, "ENDTAB")) {
      let o = e.value;
      e = r.next();
      let s = Ho[o];
      if (!s) {
        r.debug, e = r.next();
        continue;
      }
      let c = {};
      s(e, r, c), o === "VPORT" && (c.lowerLeftCorner == null && (c.lowerLeftCorner = { x: 0, y: 0 }), c.upperRightCorner == null && (c.upperRightCorner = { x: 1, y: 1 }), c.center == null && (c.center = { x: 0, y: 0 }), c.snapBasePoint == null && (c.snapBasePoint = { x: 0, y: 0 }), c.snapSpacing == null && (c.snapSpacing = { x: 0, y: 0 }), c.gridSpacing == null && (c.gridSpacing = { x: 0, y: 0 }), c.viewDirectionFromTarget == null && (c.viewDirectionFromTarget = { x: 0, y: 0, z: 1 }), c.viewTarget == null && (c.viewTarget = { x: 0, y: 0, z: 0 })), (t = a[o]) == null || t.entries.push(c);
    }
    e = r.next();
  }
  return a;
}
function jo(e, r) {
  let a = {};
  for (; !h(e, 0, "EOF") && !h(e, 0, "ENDSEC"); ) {
    if (h(e, 0, "BLOCK")) {
      let t = Wo(e = r.next(), r);
      In(t), t.name && (a[t.name] = t);
    }
    e = r.next();
  }
  return a;
}
function Wo(e, r) {
  let a = {};
  for (; !h(e, 0, "EOF"); ) {
    if (h(e, 0, "ENDBLK")) {
      for (e = r.next(); !h(e, 0, "EOF"); ) {
        if (h(e, 100, "AcDbBlockEnd")) return a;
        e = r.next();
      }
      break;
    }
    switch (e.code) {
      case 1:
        a.xrefPath = e.value;
        break;
      case 2:
        a.name = e.value;
        break;
      case 3:
        a.name2 = e.value;
        break;
      case 5:
        a.handle = e.value;
        break;
      case 8:
        a.layer = e.value;
        break;
      case 10:
        a.position = Ee(r);
        break;
      case 67:
        a.paperSpace = !!e.value && e.value == 1;
        break;
      case 70:
        e.value !== 0 && (a.type = e.value);
        break;
      case 100:
        break;
      case 330:
        a.ownerHandle = e.value;
        break;
      case 0:
        a.entities = En(e, r);
    }
    e = r.next();
  }
  return a;
}
function Yo(e, r) {
  let a = { name: "ACAD_EVALUATION_GRAPH", handle: "", ownerObjectId: "0", nodeObjectHardIds: [] };
  for (e = r.next(); e.code !== 0; ) {
    switch (e.code) {
      case 5:
        a.handle = String(e.value);
        break;
      case 330:
        a.ownerObjectId = String(e.value);
        break;
      case 360:
        a.nodeObjectHardIds.push(String(e.value));
        break;
      case 100:
        e.value === "AcDbEvalGraph" && (a.subclassMarker = "AcDbEvalGraph");
    }
    e = r.next();
  }
  return a;
}
function Xo(e, r) {
  let a = { name: "ACSH_HISTORY_CLASS", handle: "", ownerObjectId: "0" };
  for (e = r.next(); e.code !== 0; ) {
    switch (e.code) {
      case 5:
        a.handle = String(e.value);
        break;
      case 330:
        a.ownerObjectId = String(e.value);
        break;
      case 360:
        a.evalGraphHardId = String(e.value);
        break;
      case 100:
        e.value === "AcDbShHistory" && (a.subclassMarker = "AcDbShHistory");
    }
    e = r.next();
  }
  return a;
}
function J(e, r, a, t, o = !1, s) {
  let c = a(), u = "header", l = [], d = [];
  for (e = r.next(); e.code !== 0; ) {
    switch (e.code) {
      case 5:
        c.handle = String(e.value);
        break;
      case 330:
        c.ownerObjectId = String(e.value);
        break;
      case 100:
        e.value === "AcDbShHistoryNode" ? u = "matrix" : typeof e.value == "string" && e.value.startsWith("AcDbSh") && e.value !== "AcDbShHistoryNode" && (u = "primitive", s == null || s(e.value));
        break;
      case 1:
        o && (u = "acis", d.push(String(e.value)));
        break;
      case 3:
        o && d.push(String(e.value));
        break;
      default:
        if (u === "matrix" && e.code >= 40 && e.code <= 55) {
          let p = Number(e.value);
          Number.isFinite(p) && l.push(p);
        } else if (u === "primitive" && e.code >= 40 && e.code <= 99) {
          let p = Number(e.value);
          Number.isFinite(p) && (t == null || t(e.code, p, c));
        }
    }
    e = r.next();
  }
  return l.length === 16 && (c.transform = l), d.length > 0 && (c.acisData = dt(d)), c;
}
function zo(e) {
  let r = {};
  for (let a of Object.values(e)) for (let t of a) t.handle && (r[String(t.handle).toUpperCase()] = t);
  return r;
}
function Ko(e, r, a) {
  e === 40 ? a.length = r : e === 41 ? a.width = r : e === 42 && (a.height = r);
}
function gn(e, r, a) {
  e === 40 ? a.majorRadius = r : e === 41 ? a.minorRadius = r : e === 42 ? a.height = r : e === 43 && (a.topMajorRadius = r);
}
function $o(e, r, a) {
  gn(e, r, a);
}
function Zo(e, r, a) {
  e === 40 ? a.length = r : e === 41 ? a.width = r : e === 42 && (a.height = r);
}
function qo(e, r, a) {
  e === 41 && (a.radius = r);
}
function Jo(e, r) {
  return J(e, r, () => ({ name: "ACSH_BOX_CLASS", handle: "", ownerObjectId: "0" }), Ko);
}
function Qo(e, r) {
  return J(e, r, () => ({ name: "ACSH_CYLINDER_CLASS", handle: "", ownerObjectId: "0" }), $o);
}
function es(e, r) {
  let a = !1;
  return J(e, r, () => ({ name: "ACSH_CONE_CLASS", handle: "", ownerObjectId: "0" }), (t, o, s) => {
    a ? t === 40 ? s.topRadius = o : t === 41 ? s.baseRadius = o : t === 42 ? s.height = o : t === 43 && (s.minorRadius = o) : gn(t, o, s);
  }, !1, (t) => {
    t === "AcDbShCone" && (a = !0);
  });
}
function rs(e, r) {
  return J(e, r, () => ({ name: "ACSH_WEDGE_CLASS", handle: "", ownerObjectId: "0" }), Zo);
}
function as(e, r) {
  return J(e, r, () => ({ name: "ACSH_SWEEP_CLASS", handle: "", ownerObjectId: "0" }), void 0, !0);
}
function ns(e, r) {
  return J(e, r, () => ({ name: "ACSH_BREP_CLASS", handle: "", ownerObjectId: "0" }), void 0, !0);
}
function ts(e, r) {
  return J(e, r, () => ({ name: "ACSH_EXTRUSION_CLASS", handle: "", ownerObjectId: "0" }), void 0, !0);
}
function os(e, r) {
  return J(e, r, () => ({ name: "ACSH_BOOLEAN_CLASS", handle: "", ownerObjectId: "0" }));
}
function ss(e, r) {
  return J(e, r, () => ({ name: "ACSH_FILLET_CLASS", handle: "", ownerObjectId: "0" }), qo);
}
function is(e, r) {
  return J(e, r, () => ({ name: "ACSH_REVOLVE_CLASS", handle: "", ownerObjectId: "0" }), void 0, !0);
}
function cs(e, r) {
  return J(e, r, () => ({ name: "ACSH_LOFT_CLASS", handle: "", ownerObjectId: "0" }), void 0, !0);
}
let ls = { ACSH_HISTORY_CLASS: Xo, ACAD_EVALUATION_GRAPH: Yo, ACSH_BOX_CLASS: Jo, ACSH_CYLINDER_CLASS: Qo, ACSH_CONE_CLASS: es, ACSH_WEDGE_CLASS: rs, ACSH_SWEEP_CLASS: as, ACSH_BREP_CLASS: ns, ACSH_EXTRUSION_CLASS: ts, ACSH_BOOLEAN_CLASS: os, ACSH_FILLET_CLASS: ss, ACSH_REVOLVE_CLASS: is, ACSH_LOFT_CLASS: cs }, Q = [{ code: 330, name: "ownerObjectId", parser: n }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 102, parser: q }, { code: 5, name: "handle", parser: n }], ds = [{ code: 75, name: "hasLastPointRef", parser: f }, { code: 1, name: "pointRefs", parser: function(e, r) {
  let a = { className: e.value };
  for (; ; ) switch ((e = r.next()).code) {
    case 72:
      a.objectOsnapType = e.value;
      continue;
    case 331:
      a.mainObjectId = e.value;
      continue;
    case 73:
      a.mainObjectSubentityType = e.value;
      continue;
    case 91:
      a.mainObjectGsMarker = e.value;
      continue;
    case 301:
      a.mainObjectXrefHandle = e.value;
      continue;
    case 40:
      a.nearOsnapGeometryParameter = e.value;
      continue;
    case 10:
      {
        let t = i(e, r);
        a.osnapPoint = "z" in t ? t : { ...t, z: 0 };
      }
      continue;
    case 332:
      a.intersectionObjectId = e.value;
      continue;
    case 74:
      a.intersectionObjectSubentityType = e.value;
      continue;
    case 92:
      a.intersectionObjectGsMarker = e.value;
      continue;
    case 302:
      a.intersectionObjectXrefHandle = e.value;
      continue;
    default:
      return r.rewind(), a;
  }
}, isMultiple: !0 }, { code: 71, name: "rotatedDimensionType", parser: n }, { code: 70, name: "transSpaceFlag", parser: f }, { code: 90, name: "associativityFlag", parser: n }, { code: 330, name: "dimensionObjectId", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Q], us = [{ code: 3, name: "entries", parser: (e, r) => {
  let a = { name: e.value };
  return (e = r.next()).code === 350 ? a.objectSoftId = e.value : e.code === 360 ? a.objectHardId = e.value : r.rewind(), a;
}, isMultiple: !0 }, { code: 281, name: "recordCloneFlag", parser: n }, { code: 280, name: "isHardOwned", parser: f }, { code: 100, name: "subclassMarker", parser: n }, ...Q], ps = [{ code: 340, name: "entityIds", parser: n, isMultiple: !0 }, { code: 71, name: "isSelectable", parser: f }, { code: 70, name: "isUnnamed", parser: f }, { code: 300, name: "description", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Q], ms = [{ code: 330, name: "imageDefReactorIdSoft", isMultiple: !0, parser: n }, { code: 90, name: "version", parser: n }, { code: 1, name: "fileName", parser: n }, { code: 10, name: "size", parser: i }, { code: 11, name: "sizeOfOnePixel", parser: i }, { code: 280, name: "isLoaded", parser: n }, { code: 281, name: "resolutionUnits", parser: n }, { code: 100, name: "subclassMarker", parser: n }], fs = [{ code: 8, name: "layerNames", parser: n, isMultiple: !0 }, { code: 100, name: "subclassMarker", parser: n }, { code: 100, name: "filterSubclassMarker", parser: n }, ...Q], bs = [{ code: 90, name: "idBufferEntryCounts", parser: n, isMultiple: !0 }, { code: 360, name: "idBufferIds", parser: n, isMultiple: !0 }, { code: 8, name: "layerNames", parser: n, isMultiple: !0 }, { code: 100, name: "subclassMarker", parser: n }, { code: 40, name: "timeStamp", parser: n }, { code: 100, name: "indexSubclassMarker", parser: n }, ...Q], Sn = [{ code: 333, name: "shadePlotId", parser: n }, { code: 149, name: "imageOriginY", parser: n }, { code: 148, name: "imageOriginX", parser: n }, { code: 147, name: "scaleFactor", parser: n }, { code: 78, name: "shadePlotCustomDPI", parser: n }, { code: 77, name: "shadePlotResolution", parser: n }, { code: 76, name: "shadePlotMode", parser: n }, { code: 75, name: "standardScaleType", parser: n }, { code: 7, name: "currentStyleSheet", parser: n }, { code: 74, name: "plotType", parser: n }, { code: 73, name: "plotRotation", parser: n }, { code: 72, name: "plotPaperUnit", parser: n }, { code: 70, name: "layoutFlag", parser: n }, { code: 143, name: "printScaleDenominator", parser: n }, { code: 142, name: "printScaleNumerator", parser: n }, { code: 141, name: "windowAreaYMax", parser: n }, { code: 140, name: "windowAreaXMax", parser: n }, { code: 49, name: "windowAreaYMin", parser: n }, { code: 48, name: "windowAreaXMin", parser: n }, { code: 47, name: "plotOriginY", parser: n }, { code: 46, name: "plotOriginX", parser: n }, { code: 45, name: "paperHeight", parser: n }, { code: 44, name: "paperWidth", parser: n }, { code: 43, name: "marginTop", parser: n }, { code: 42, name: "marginRight", parser: n }, { code: 41, name: "marginBottom", parser: n }, { code: 40, name: "marginLeft", parser: n }, { code: 6, name: "plotViewName", parser: n }, { code: 4, name: "paperSize", parser: n }, { code: 2, name: "configName", parser: n }, { code: 1, name: "pageSetupName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Q], hs = [{ code: 346, name: "orthographicUcsId", parser: n }, { code: 345, name: "namedUcsId", parser: n }, { code: 331, name: "viewportId", parser: n }, { code: 330, name: "paperSpaceTableId", parser: n }, { code: 76, name: "orthographicType", parser: n }, { code: 17, name: "ucsYAxis", parser: i }, { code: 16, name: "ucsXAxis", parser: i }, { code: 13, name: "ucsOrigin", parser: i }, { code: 146, name: "elevation", parser: n }, { code: 15, name: "maxExtent", parser: i }, { code: 14, name: "minExtent", parser: i }, { code: 12, name: "insertionPoint", parser: i }, { code: 11, name: "maxLimit", parser: i }, { code: 10, name: "minLimit", parser: i }, { code: 71, name: "tabOrder", parser: n }, { code: 70, name: "controlFlag", parser: n }, { code: 1, name: "layoutName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Sn], Is = [{ code: 179, name: "unknown1", parser: n }, { code: 170, name: "contentType", parser: n }, { code: 171, name: "drawMLeaderOrderType", parser: n }, { code: 172, name: "drawLeaderOrderType", parser: n }, { code: 90, name: "maxLeaderSegmentPoints", parser: n }, { code: 40, name: "firstSegmentAngleConstraint", parser: n }, { code: 41, name: "secondSegmentAngleConstraint", parser: n }, { code: 173, name: "leaderLineType", parser: n }, { code: 91, name: "leaderLineColor", parser: n }, { code: 340, name: "leaderLineTypeId", parser: n }, { code: 92, name: "leaderLineWeight", parser: n }, { code: 290, name: "landingEnabled", parser: f }, { code: 42, name: "landingGap", parser: n }, { code: 291, name: "doglegEnabled", parser: f }, { code: 43, name: "doglegLength", parser: n }, { code: 3, name: "description", parser: n }, { code: 341, name: "arrowheadId", parser: n }, { code: 44, name: "arrowheadSize", parser: n }, { code: 300, name: "defaultMTextContents", parser: n }, { code: 342, name: "textStyleId", parser: n }, { code: 174, name: "textLeftAttachmentType", parser: n }, { code: 175, name: "textAngleType", parser: n }, { code: 176, name: "textAlignmentType", parser: n }, { code: 178, name: "textRightAttachmentType", parser: n }, { code: 93, name: "textColor", parser: n }, { code: 45, name: "textHeight", parser: n }, { code: 292, name: "textFrameEnabled", parser: f }, { code: 297, name: "textAlignAlwaysLeft", parser: f }, { code: 46, name: "alignSpace", parser: n }, { code: 343, name: "blockContentId", parser: n }, { code: 94, name: "blockContentColor", parser: n }, { code: 47, name: "blockContentScale.x", parser: n }, { code: 49, name: "blockContentScale.y", parser: n }, { code: 140, name: "blockContentScale.z", parser: n }, { code: 293, name: "blockContentScaleEnabled", parser: f }, { code: 141, name: "blockContentRotation", parser: n }, { code: 294, name: "blockContentRotationEnabled", parser: f }, { code: 177, name: "blockContentConnectionType", parser: n }, { code: 142, name: "scale", parser: n }, { code: 295, name: "overwritePropertyValue", parser: f }, { code: 296, name: "annotative", parser: f }, { code: 143, name: "breakGapSize", parser: n }, { code: 271, name: "textAttachmentDirection", parser: n }, { code: 272, name: "bottomTextAttachmentDirection", parser: n }, { code: 273, name: "topTextAttachmentDirection", parser: n }, { code: 298, name: "unknown2", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Q];
function cr(e, r, a) {
  e.elements || (e.elements = []);
  let t = e.elements.find((o) => o[r] === void 0);
  if (t) {
    t[r] = a;
    return;
  }
  e.elements.push({ [r]: a });
}
let Es = [{ code: 6, parser: function({ value: e }, r, a) {
  cr(a, "lineType", e);
}, isMultiple: !0 }, { code: 62, parser: function({ value: e }, r, a) {
  var t;
  if (a.fillColorIndex === void 0 && !((t = a.elements) != null && t.length)) {
    a.fillColorIndex = e;
    return;
  }
  cr(a, "colorIndex", e);
}, isMultiple: !0 }, { code: 420, parser: function({ value: e }, r, a) {
  var t;
  if (a.fillColor === void 0 && !((t = a.elements) != null && t.length)) {
    a.fillColor = e;
    return;
  }
  cr(a, "color", e);
}, isMultiple: !0 }, { code: 49, parser: function({ value: e }, r, a) {
  cr(a, "offset", e);
}, isMultiple: !0 }, { code: 71, name: "elementCount", parser: n }, { code: 52, name: "endAngle", parser: n }, { code: 51, name: "startAngle", parser: n }, { code: 3, name: "description", parser: n }, { code: 70, name: "flags", parser: n }, { code: 2, name: "styleName", parser: n }, { code: 100, name: "subclassMarker", parser: n }, ...Q], gs = [{ code: 40, name: "wcsToOCSTransform", parser: $r }, { code: 40, name: "ocsToWCSTransform", parser: $r }, { code: 41, name: "backClippingDistance", parser: n }, { code: 73, name: "isBackClipping", parser: f, pushContext: !0 }, { code: 40, name: "frontClippingDistance", parser: n }, { code: 72, name: "isFrontClipping", parser: f, pushContext: !0 }, { code: 71, name: "isClipBoundaryDisplayed", parser: f }, { code: 11, name: "position", parser: i }, { code: 210, name: "normal", parser: i }, { code: 10, name: "boundaryVertices", parser: i, isMultiple: !0 }, { code: 70, name: "boundaryCount", parser: n }, { code: 100, name: "subclassMarker", parser: n }, { code: 100 }, ...Q];
function $r(e, r) {
  let a = [];
  for (let t = 0; t < 3 && h(e, 40); ++t) {
    let o = [];
    for (let s = 0; s < 4 && h(e, 40); ++s) o.push(e.value), e = r.next();
    a.push(o);
  }
  return r.rewind(), a;
}
let Ss = [{ code: 280, name: "cloneFlag", parser(e, r, a) {
  var t, o;
  let s = e.value;
  for (e = r.next(), a.data = []; 1 <= (t = e.code) && t <= 369 && t !== 5 && t !== 105; )
    a.data.push(310 <= (o = e).code && o.code <= 319 && typeof o.value == "string" ? { ...o, value: o.value.toUpperCase() } : o), e = r.next();
  return r.rewind(), s;
} }, { code: 100, name: "subclassMarker", parser: n }, ...Q], vs = { LAYOUT: hs, PLOTSETTINGS: Sn, DICTIONARY: us, SPATIAL_FILTER: gs, IMAGEDEF: ms, MLEADERSTYLE: Is, MLINESTYLE: Es, GROUP: ps, LAYER_FILTER: fs, LAYER_INDEX: bs, DIMASSOC: ds, XRECORD: Ss };
function ys(e, r) {
  let a = [];
  for (; e.code !== 0 || !["EOF", "ENDSEC"].includes(String(e.value)); ) {
    let o = String(e.value), s = vs[o], c = ls[o];
    if (e.code === 0 && c) a.push(c(e, r)), e = r.lastReadGroup;
    else if (e.code === 0 && (s != null && s.length)) {
      let u = m(s), l = { name: o };
      u(e = r.next(), r, l) ? (a.push(l), e = r.peek()) : e = r.next();
    } else e = e.code === 0 ? (function(u, l) {
      let d = l.next();
      for (; d.code !== 0; ) d = l.next();
      return d;
    })(0, r) : r.next();
  }
  let t = et(a, ({ name: o }) => o);
  return { byName: t, byHandle: zo(t) };
}
let Mr = "ASM_Data";
function xs(e) {
  return String(e).trim().toUpperCase();
}
function Os(e, r) {
  let a = {};
  for (; e.code !== 0 || !["EOF", "ENDSEC"].includes(String(e.value)); ) if (e.code === 0 && e.value === "ACDSRECORD") {
    let t = (function(o) {
      let s, c, u = {}, l = o.next();
      for (; l.code !== 0; ) {
        switch (l.code) {
          case 320:
            s = xs(String(l.value));
            break;
          case 2:
            var d;
            u[d = c = String(l.value)] ?? (u[d] = []);
            break;
          case 310:
            c && u[c].push(String(l.value));
        }
        l = o.next();
      }
      let p = u[Mr] ?? [];
      return { ownerHandle: s, dataType: p.length > 0 ? Mr : void 0, hexChunks: p };
    })(r);
    if (t.ownerHandle && t.dataType === Mr && t.hexChunks.length > 0) {
      let o = (function(s) {
        let c = s.replace(/\s+/g, "");
        if (c.length === 0) return new Uint8Array(0);
        if (c.length % 2 != 0) return;
        let u = c.length / 2, l = new Uint8Array(u);
        for (let d = 0; d < u; d++) {
          let p = Number.parseInt(c.slice(2 * d, 2 * d + 2), 16);
          if (p < 0 || p > 255) return;
          l[d] = p;
        }
        return l;
      })(t.hexChunks.join(""));
      o && (a[t.ownerHandle] = o);
    }
    e = r.lastReadGroup;
  } else e.code, e = r.next();
  return { byOwnerHandle: a };
}
let Be = new Uint8Array([...new TextEncoder().encode(`AutoCAD Binary DXF\r
`), 26, 0]), As = new Set(_(290, 300)), Ts = /* @__PURE__ */ new Set([..._(60, 80), ..._(170, 180), ..._(270, 290), ..._(370, 390), ..._(400, 410), ..._(1060, 1071)]), Ns = /* @__PURE__ */ new Set([..._(90, 100), ..._(420, 430), ..._(440, 460), 1071]), Ds = new Set(_(160, 170)), Cs = /* @__PURE__ */ new Set([..._(10, 60), ..._(110, 150), ..._(210, 240), ..._(460, 470), ..._(1010, 1060)]), Ls = /* @__PURE__ */ new Set([..._(310, 320), 1004]);
function Gr(e) {
  if (e.length < Be.length) return !1;
  for (let r = 0; r < Be.length; r++) if (e[r] !== Be[r]) return !1;
  return !0;
}
function ks(e) {
  return (e.charCodeAt(0) === 65279 ? e.slice(1) : e).startsWith("AutoCAD Binary DXF");
}
function _s(e, r = {}) {
  if (!Gr(e)) throw Error("Not a binary DXF file.");
  let { dxfVersion: a, encoding: t, r12: o } = (function(d, p, b) {
    let v, g = !(function(F) {
      let M = Be.length;
      return F.length < M + 9 || (F[M] === 0 && F[M + 1] === 0 ? qr(F.subarray(M + 2, M + 9)) === "SECTION" : F[M] !== 0 || qr(F.subarray(M + 1, M + 8)) !== "SECTION");
    })(d), x = new DataView(d.buffer, d.byteOffset, d.byteLength), y = Zr(b), N = "AC1009", w = p, V = Be.length, Ve = Math.min(d.length, V + 8192);
    for (; V < Ve; ) {
      let [F, M] = lr(d, V, g), [Ie, Sr] = dr(d, x, M, F, w, y);
      if (F === 9 && Ie === "$ACADVER") {
        let [Re, vr] = lr(d, Sr, g), [yr, xr] = dr(d, x, vr, Re, "utf-8", y);
        Re === 1 && (N = yr), V = xr;
        continue;
      }
      if (F === 9 && Ie === "$DWGCODEPAGE") {
        let [Re, vr] = lr(d, Sr, g), [yr, xr] = dr(d, x, vr, Re, "ascii", y);
        (Re === 3 || Re === 1) && (v = yr), V = xr;
        continue;
      }
      if (V = Sr, F === 0 && (Ie === "ENDSEC" || Ie === "EOF")) break;
    }
    return N >= "AC1021" ? w = "utf-8" : v && (w = (function(F) {
      let M = /^ANSI_(\d+)$/i.exec(F);
      if (!M) return;
      let Ie = M[1];
      return Ie === "1252" ? "windows-1252" : Ie === "949" ? "euc-kr" : `windows-${Ie}`;
    })(v) ?? p), { dxfVersion: N, encoding: w, r12: g };
  })(e, r.encoding ?? "windows-1252", r.encodingFailureFatal ?? !1), s = [], c = new DataView(e.buffer, e.byteOffset, e.byteLength), u = Zr(r.encodingFailureFatal ?? !1), l = Be.length;
  for (; l < e.length; ) {
    let [d, p] = lr(e, l, o), [b, v] = dr(e, c, l = p, d, t, u);
    if (l = v, s.push(String(d), b), d === 0 && b === "EOF") break;
  }
  if (s.length < 2 || s[s.length - 1] !== "EOF") throw Error(`Binary DXF ended without EOF group (version ${a}, offset ${l}).`);
  return s;
}
function lr(e, r, a) {
  if (a) {
    let t = e[r];
    return r += 1, t === 255 && (t = e[r] | e[r + 1] << 8, r += 2), [t, r];
  }
  return [e[r] | e[r + 1] << 8, r + 2];
}
function dr(e, r, a, t, o, s) {
  var c, u;
  let l;
  if (Ls.has(t)) {
    let b = e[a];
    a += 1;
    let v = e.subarray(a, a + b);
    return a += b, [(function(g) {
      let x = "";
      for (let y = 0; y < g.length; y++) x += g[y].toString(16).padStart(2, "0");
      return x;
    })(v), a];
  }
  if (As.has(t)) return [e[a] !== 0 ? "1" : "0", a + 1];
  if (Ts.has(t)) return [String(r.getInt16(a, !0)), a + 2];
  if (Ns.has(t)) return [String(r.getInt32(a, !0)), a + 4];
  if (Ds.has(t)) return [String(Number(r.getBigInt64(a, !0))), a + 8];
  if (Cs.has(t)) return [String(r.getFloat64(a, !0)), a + 8];
  let d = a, p = d;
  for (; p < e.length && e[p] !== 0; ) p++;
  return [(c = s, u = o, (l = c.byEncoding.get(u)) || (l = new TextDecoder(u, { fatal: c.fatal }), c.byEncoding.set(u, l)), l).decode(e.subarray(d, p)), p + 1];
}
function Zr(e) {
  return { fatal: e, byEncoding: /* @__PURE__ */ new Map() };
}
function _(e, r) {
  let a = [];
  for (let t = e; t < r; t++) a.push(t);
  return a;
}
function qr(e) {
  return new TextDecoder("ascii").decode(e);
}
function vn(e) {
  if (ks(e.charCodeAt(0) === 65279 ? e.slice(1) : e)) throw Error("Binary DXF cannot be parsed from a text string. Read the file as ArrayBuffer/Uint8Array and use DxfParser.parseBuffer() instead.");
  return (e.charCodeAt(0) === 65279 ? e.slice(1) : e).split(/\r\n|\r|\n/g);
}
function ws(e, r = {}) {
  return Gr(e) ? _s(e, { encoding: r.encoding, encodingFailureFatal: r.encodingFailureFatal }) : vn(new TextDecoder(r.encoding ?? "utf-8", { fatal: r.encodingFailureFatal ?? !1 }).decode(e));
}
function Er(e, r, a) {
  return r in e ? Object.defineProperty(e, r, { value: a, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = a, e;
}
class Ms {
  constructor() {
    Er(this, "encoding", "utf-8"), Er(this, "encodingFailureFatal", !1), Er(this, "thumbnailImageFormat", "base64");
  }
}
class Fs extends EventTarget {
  parseSync(r, a = !1) {
    return this.parseLines(vn(r), a);
  }
  parseBuffer(r, a = !1) {
    return this.parseLines(ws(r, { encoding: this._options.encoding, encodingFailureFatal: this._options.encodingFailureFatal }), a);
  }
  parseStream(r) {
    let a = [], t = this;
    return new Promise((o, s) => {
      r.on("data", (c) => {
        typeof c == "string" ? a.push(new TextEncoder().encode(c)) : a.push(c);
      }), r.on("end", () => {
        try {
          let c = a.reduce((d, p) => d + p.length, 0), u = new Uint8Array(c), l = 0;
          for (let d of a) u.set(d, l), l += d.length;
          o(t.parseBuffer(u));
        } catch (c) {
          s(c);
        }
      }), r.on("error", (c) => {
        s(c);
      });
    });
  }
  async parseFromUrl(r, a) {
    let t = await fetch(r, a);
    if (!t.ok) throw Error(`Failed to fetch DXF: ${t.status} ${t.statusText}`);
    let o = await t.arrayBuffer();
    if (o.byteLength === 0) throw Error(`Failed to fetch DXF: empty response body from ${r}`);
    return this.parseBuffer(new Uint8Array(o));
  }
  parseLines(r, a = !1) {
    let t = new It(r, a);
    if (!t.hasNext()) throw Error("Empty file");
    return this.parseAll(t);
  }
  parseAll(r) {
    let a = { header: {}, blocks: {}, entities: [], tables: {}, objects: { byName: {}, byHandle: {}, byTree: void 0 }, acdsData: { byOwnerHandle: {} } }, t = r.next();
    for (; !h(t, 0, "EOF"); ) h(t, 0, "SECTION") && (h(t = r.next(), 2, "HEADER") ? a.header = To(t = r.next(), r) : h(t, 2, "CLASSES") ? Bn(t = r.next(), r, a) : h(t, 2, "BLOCKS") ? a.blocks = jo(t = r.next(), r) : h(t, 2, "ENTITIES") ? a.entities = En(t = r.next(), r) : h(t, 2, "TABLES") ? a.tables = Go(t = r.next(), r) : h(t, 2, "OBJECTS") ? a.objects = ys(t = r.next(), r) : h(t, 2, "THUMBNAILIMAGE") ? a.thumbnailImage = (function(o, s, c = "base64") {
      let u, l = "", d = 0;
      for (; !h(o, 0, "EOF") && !h(o, 0, "ENDSEC"); ) o.code === 90 ? d = o.value : o.code === 310 && (l += o.value), o = s.next();
      if (c === "hex") u = l;
      else {
        let p = (function(b) {
          let v = b.length / 2, g = new Uint8Array(v);
          for (let x = 0; x < v; x++) g[x] = parseInt(b.substr(2 * x, 2), 16);
          return g;
        })(l);
        u = c === "buffer" ? p : (function(b) {
          let v = "";
          for (let g = 0; g < b.length; g++) v += String.fromCharCode(b[g]);
          return btoa(v);
        })(p);
      }
      return { size: d, data: u };
    })(t = r.next(), r, this._options.thumbnailImageFormat) : h(t, 2, "ACDSDATA") && (a.acdsData = Os(t = r.next(), r))), t = r.next();
    return a;
  }
  constructor(r = {}) {
    super(), Er(this, "_options", void 0);
    let a = new Ms();
    this._options = Object.assign(a, r);
  }
}
(W = {})[W.NOT_APPLICABLE = 0] = "NOT_APPLICABLE", W[W.KEEP_EXISTING = 1] = "KEEP_EXISTING", W[W.USE_CLONE = 2] = "USE_CLONE", W[W.XREF_VALUE_NAME = 3] = "XREF_VALUE_NAME", W[W.VALUE_NAME = 4] = "VALUE_NAME", W[W.UNMANGLE_NAME = 5] = "UNMANGLE_NAME";
(we = {})[we.NOUNIT = 0] = "NOUNIT", we[we.CENTIMETERS = 2] = "CENTIMETERS", we[we.INCH = 5] = "INCH";
(nr = {})[nr.PSLTSCALE = 1] = "PSLTSCALE", nr[nr.LIMCHECK = 2] = "LIMCHECK";
(Me = {})[Me.INCHES = 0] = "INCHES", Me[Me.MILLIMETERS = 1] = "MILLIMETERS", Me[Me.PIXELS = 2] = "PIXELS";
(Y = {})[Y.LAST_SCREEN_DISPLAY = 0] = "LAST_SCREEN_DISPLAY", Y[Y.DRAWING_EXTENTS = 1] = "DRAWING_EXTENTS", Y[Y.DRAWING_LIMITS = 2] = "DRAWING_LIMITS", Y[Y.VIEW_SPECIFIED = 3] = "VIEW_SPECIFIED", Y[Y.WINDOW_SPECIFIED = 4] = "WINDOW_SPECIFIED", Y[Y.LAYOUT_INFORMATION = 5] = "LAYOUT_INFORMATION";
(me = {})[me.AS_DISPLAYED = 0] = "AS_DISPLAYED", me[me.WIREFRAME = 1] = "WIREFRAME", me[me.HIDDEN = 2] = "HIDDEN", me[me.RENDERED = 3] = "RENDERED";
(X = {})[X.DRAFT = 0] = "DRAFT", X[X.PREVIEW = 1] = "PREVIEW", X[X.NORMAL = 2] = "NORMAL", X[X.PRESENTATION = 3] = "PRESENTATION", X[X.MAXIMUM = 4] = "MAXIMUM", X[X.CUSTOM = 5] = "CUSTOM";
(fe = {})[fe.NONE = 0] = "NONE", fe[fe.AbsoluteRotation = 1] = "AbsoluteRotation", fe[fe.TextEmbedded = 2] = "TextEmbedded", fe[fe.ShapeEmbedded = 4] = "ShapeEmbedded";
(kr = {})[kr.PaperSpace = 1] = "PaperSpace";
(Fe = {})[Fe.XrefDependent = 16] = "XrefDependent", Fe[Fe.XrefResolved = 32] = "XrefResolved", Fe[Fe.Referenced = 64] = "Referenced";
(z = {})[z.Off = 0] = "Off", z[z.Perspective = 1] = "Perspective", z[z.ClipFront = 2] = "ClipFront", z[z.ClipBack = 4] = "ClipBack", z[z.UcsFollow = 8] = "UcsFollow", z[z.ClipFrontByFrontZ = 16] = "ClipFrontByFrontZ";
class Rs {
  parse(r) {
    const a = new Uint8Array(r), t = new Fs();
    if (Gr(a))
      return t.parseBuffer(a);
    const o = this.getDxfInfoFromBuffer(r);
    let s = "";
    return o.version && o.version.value <= 23 && o.encoding ? s = new TextDecoder(o.encoding).decode(r) : s = new TextDecoder().decode(r), t.parseSync(s);
  }
  getDxfInfoFromBuffer(r) {
    var d, p, b;
    const t = new TextDecoder("utf-8");
    let o = 0, s = "", c = null, u = null, l = !1;
    for (; o < r.byteLength; ) {
      const v = Math.min(o + 65536, r.byteLength), g = r.slice(o, v);
      o = v;
      const y = (s + t.decode(g, { stream: !0 })).split(/\r?\n/);
      s = y.pop() ?? "";
      for (let N = 0; N < y.length; N++) {
        const w = y[N].trim();
        if (w === "SECTION" && ((d = y[N + 2]) == null ? void 0 : d.trim()) === "HEADER")
          l = !0;
        else if (w === "ENDSEC" && l)
          return { version: c, encoding: u };
        if (l && w === "$ACADVER") {
          const V = (p = y[N + 2]) == null ? void 0 : p.trim();
          V && (c = new yn(V));
        } else if (l && w === "$DWGCODEPAGE") {
          const V = (b = y[N + 2]) == null ? void 0 : b.trim();
          if (V) {
            const Ve = Fr[V];
            u = Nn(Ve);
          }
        }
        if (c && u)
          return { version: c, encoding: u };
      }
    }
    return { version: c, encoding: u };
  }
}
class Ps extends An {
  async executeTask(r) {
    return new Rs().parse(r);
  }
}
new Ps();
