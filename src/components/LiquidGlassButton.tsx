// Light Glass Button — Originkit

"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

const radiusFromPercent = (w: number, h: number, pct: number) =>
    (Math.min(w, h) / 2) * (Math.max(0, Math.min(100, pct)) / 100)

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect

type StrokeType = "solid" | "gradient"

export type Colors = {
    fill?: string
    textColor?: string
    hoverFill?: string
    hoverTextColor?: string
}

export interface Props {
    colors?: Colors
    label?: string
    font?: React.CSSProperties
    showText?: boolean
    padding?: string
    rounded?: number
    fill?: string
    textColor?: string
    addIcon?: boolean
    icon?: {
        image?: string | { src?: string; srcSet?: string; alt?: string }
        side?: "left" | "right"
        size?: number
        padding?: number
        rounded?: number
    }
    gap?: number
    stroke?: {
        width?: number
        type?: StrokeType
        color?: string
        colorA?: string
        colorB?: string
        angle?: number
    }
    light?: {
        color?: string
        size?: number
        intensity?: number
        smoothness?: number
    }
    link?: string
    newTab?: boolean
    style?: React.CSSProperties
}

const BLUR = 20
const TINT = 0.16

const STROKE_BRIGHTNESS = 140
const LIGHT_FADE = 0.6
const AIM_BLEND = 0.18

const LIGHT_FALLOFF: Array<[number, number]> = [
    [0, 1],
    [0.08, 0.95],
    [0.18, 0.85],
    [0.3, 0.7],
    [0.42, 0.54],
    [0.55, 0.38],
    [0.68, 0.24],
    [0.8, 0.13],
    [0.9, 0.06],
    [0.96, 0.02],
    [1, 0],
]

const lightRadius = (w: number, h: number, pct: number) =>
    Math.max(w, h) * (Math.max(0, Math.min(100, pct)) / 100)

function supportsBackdrop(): boolean {
    if (
        typeof window === "undefined" ||
        typeof CSS === "undefined" ||
        !CSS.supports
    )
        return true
    return (
        CSS.supports("backdrop-filter", "blur(2px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(2px)")
    )
}

type RGBA = { r: number; g: number; b: number; a: number }
const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 }

function parseColor(input?: string): RGBA {
    if (!input) return WHITE
    let c = String(input).trim()

    const token = c.match(/^var\([^,]+,\s*(.+)\)$/i)
    if (token) c = token[1].trim()

    if (c[0] === "#") {
        let h = c.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((ch) => ch + ch)
                .join("")
        if (h.length !== 6 && h.length !== 8) return WHITE
        const n = parseInt(h, 16)
        if (Number.isNaN(n)) return WHITE
        return h.length === 6
            ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
            : {
                  r: (n >>> 24) & 255,
                  g: (n >>> 16) & 255,
                  b: (n >>> 8) & 255,
                  a: (n & 255) / 255,
              }
    }

    const fn = c.match(/rgba?\(([^)]+)\)/i)
    if (fn) {
        const p = fn[1]
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number)
        if (p.length >= 3 && p.slice(0, 3).every((v) => !Number.isNaN(v)))
            return {
                r: p[0],
                g: p[1],
                b: p[2],
                a: p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1,
            }
    }
    return WHITE
}

const rgba = (c: RGBA, a: number) =>
    `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.max(0, Math.min(1, a))})`

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const RING_MASK: React.CSSProperties = {
    maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
    maskClip: "border-box, content-box",
    maskComposite: "exclude",
    WebkitMaskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
    WebkitMaskClip: "border-box, content-box",
    WebkitMaskComposite: "xor",
} as React.CSSProperties

function __OriginkitBase_LiquidGlassButton(props: Props) {
    const {
        label = "GLASS BUTTON",
        font = { fontFamily: "Inter", fontWeight: 500, fontSize: 40 },
        showText = true,
        padding = "40px 64px 40px 64px",
        rounded = 38,
        fill: fillProp,
        textColor: textColorProp,
        colors,
        addIcon = false,

        icon = { side: "left", size: 24, image: "", padding: 0, rounded: 0 },
        gap = 12,
        stroke = {
            type: "gradient",
            angle: 180,
            color: "rgba(255, 255, 255, 0.45)",
            width: 6,
            colorA: "rgba(255, 255, 255, 0.55)",
            colorB: "rgba(255, 255, 255, 0.25)",
        },
        light = {
            size: 40,
            color: "rgba(255, 255, 255, 0.45)",
            intensity: 100,
            smoothness: 65,
        },
        link = "",
        newTab = true,
        style,
    } = props

    const fill = colors?.fill ?? fillProp ?? "#FFFFFF"
    const textColor = colors?.textColor ?? textColorProp ?? "#FFFFFF"

    const {
        width: strokeWidth = 6,
        type: strokeType = "gradient",
        color: strokeColor = "rgba(255, 255, 255, 0.45)",
        colorA: strokeColorA = "rgba(255, 255, 255, 0.55)",
        colorB: strokeColorB = "rgba(255, 255, 255, 0.25)",
        angle: strokeAngle = 180,
    } = stroke

    const {
        color: lightColor = "rgba(255, 255, 255, 0.45)",
        size: lightSize = 40,
        intensity: lightIntensity = 100,
        smoothness = 65,
    } = light

    const Tag: any = link ? "a" : "button"
    const tagProps = {
        "aria-label": showText ? undefined : label || undefined,
        ...(link
            ? {
                  href: link,
                  target: newTab ? "_blank" : undefined,
                  rel: newTab ? "noopener noreferrer" : undefined,
              }
            : { type: "button" }),
    }

    const scope = useRef<HTMLDivElement>(null)

    const [radiusBox, setRadiusBox] = useState({ w: 0, h: 0 })
    useIsoLayoutEffect(() => {
        const el = scope.current as HTMLElement | null
        if (!el) return
        const read = () =>
            setRadiusBox((prev) =>
                prev.w === el.offsetWidth && prev.h === el.offsetHeight
                    ? prev
                    : { w: el.offsetWidth, h: el.offsetHeight }
            )
        read()
        const ro = new ResizeObserver(read)
        ro.observe(el)
        return () => ro.disconnect()
    }, [scope])
    const radiusPx = radiusFromPercent(radiusBox.w, radiusBox.h, rounded)
    const glassRef = useRef<HTMLElement>(null)
    const lightRef = useRef<HTMLSpanElement>(null)
    const strokeRef = useRef<HTMLSpanElement>(null)

    const [glassy, setGlassy] = useState(true)
    useEffect(() => setGlassy(supportsBackdrop()), [])

    const tgt = useRef({ x: 0.5, y: 0.5, on: 0 })
    const cur = useRef({ x: 0.5, y: 0.5, on: 0 })
    const raf = useRef<number | null>(null)
    const last = useRef(0)
    const live = useRef({ smoothness, lightIntensity, lightSize })
    live.current = { smoothness, lightIntensity, lightSize }
    const box = useRef({ w: 0, h: 0 })

    useEffect(() => {
        const stop = () => {
            if (raf.current != null) cancelAnimationFrame(raf.current)
            raf.current = null
        }
        return stop
    }, [])

    useEffect(() => {
        const el = glassRef.current
        const root = scope.current as HTMLElement | null
        if (!el || !root) return
        const write = () => {
            const r = el.getBoundingClientRect()
            box.current = { w: r.width, h: r.height }
            const R = lightRadius(r.width, r.height, live.current.lightSize)
            root.style.setProperty("--lr", `${R.toFixed(1)}px`)
        }
        write()
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(write)
        ro.observe(el)
        return () => ro.disconnect()

    }, [lightSize])

    const paint = () => {
        const root = scope.current as HTMLElement | null
        const c = cur.current
        if (root) {
            root.style.setProperty("--mx", `${(c.x * 100).toFixed(2)}%`)
            root.style.setProperty("--my", `${(c.y * 100).toFixed(2)}%`)
        }
        const amt = Math.max(0, Math.min(100, live.current.lightIntensity)) / 100
        if (lightRef.current)
            lightRef.current.style.opacity = (c.on * amt).toFixed(3)

        const el = strokeRef.current
        if (el) {
            const w = box.current.w
            const h = box.current.h

            const d = clamp01(
                Math.max(Math.abs(c.x - 0.5), Math.abs(c.y - 0.5)) * 2
            )

            let ang = 0
            let half = 30
            if (w > 0 && h > 0) {
                const px = c.x * w
                const py = c.y * h
                const s = Math.max(1, Math.min(w, h) * AIM_BLEND)
                const sides: Array<[number, number, number]> = [
                    [px, 0, py],
                    [w - px, w, py],
                    [py, px, 0],
                    [h - py, px, h],
                ]
                const near = Math.min(...sides.map((v) => v[0]))
                let wt = 0
                let ax = 0
                let ay = 0
                for (const [dist, sx, sy] of sides) {
                    const k = Math.exp(-(dist - near) / s)
                    wt += k
                    ax += k * sx
                    ay += k * sy
                }
                const ex = ax / wt - w / 2
                const ey = ay / wt - h / 2

                ang = (Math.atan2(ey, ex) * 180) / Math.PI + 90

                const L = Math.max(1, Math.hypot(ex, ey))
                const reach =
                    lightRadius(w, h, live.current.lightSize) * LIGHT_FADE
                half = (Math.atan(reach / L) * 180) / Math.PI
            }

            el.style.setProperty("--la", ang.toFixed(1))
            el.style.setProperty(
                "--lw",
                Math.max(3, Math.min(70, half)).toFixed(1)
            )
            el.style.opacity = clamp01(c.on * d * d * amt).toFixed(3)
        }
    }

    const tick = (t: number) => {
        const c = cur.current
        const g = tgt.current

        const dt = last.current
            ? Math.min(0.05, (t - last.current) / 1000)
            : 1 / 60
        last.current = t
        const s = Math.max(0, Math.min(100, live.current.smoothness)) / 100
        const per = 0.5 - s * 0.46
        const k = 1 - Math.pow(1 - per, dt * 60)

        c.x += (g.x - c.x) * k
        c.y += (g.y - c.y) * k
        c.on += (g.on - c.on) * k
        paint()

        const settled =
            Math.abs(g.x - c.x) < 0.001 &&
            Math.abs(g.y - c.y) < 0.001 &&
            Math.abs(g.on - c.on) < 0.002
        if (settled && g.on === 0) {
            c.x = g.x
            c.y = g.y
            c.on = 0
            paint()
            raf.current = null
            last.current = 0
            return
        }
        raf.current = requestAnimationFrame(tick)
    }

    const kick = () => {
        if (raf.current == null) {
            last.current = 0
            raf.current = requestAnimationFrame(tick)
        }
    }

    const trackPointer = (e: React.PointerEvent) => {
        const el = glassRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        tgt.current.x = (e.clientX - r.left) / r.width
        tgt.current.y = (e.clientY - r.top) / r.height
        kick()
    }

    const onEnter = (e: React.PointerEvent) => {
        const el = glassRef.current
        if (el) {
            const r = el.getBoundingClientRect()
            if (r.width && r.height) {
                const x = (e.clientX - r.left) / r.width
                const y = (e.clientY - r.top) / r.height
                tgt.current.x = x
                tgt.current.y = y
                if (cur.current.on === 0) {
                    cur.current.x = x
                    cur.current.y = y
                }
            }
        }
        tgt.current.on = 1
        kick()
    }

    const onLeave = (e: React.PointerEvent) => {
        trackPointer(e)
        tgt.current.on = 0
        kick()
    }

    const backdrop = glassy
        ? `blur(${BLUR}px) saturate(180%) brightness(108%)`
        : "none"

    const glassRGB = parseColor(fill)

    const glassBackground = glassy
        ? rgba(glassRGB, TINT)
        :
          rgba(glassRGB, 0.62)

    const lightRGB = parseColor(lightColor)

    const lightClear = rgba(lightRGB, 0)
    const softStops = (peak: number) =>
        LIGHT_FALLOFF.map(
            ([at, k]) => `${rgba(lightRGB, peak * k)} ${Math.round(at * 100)}%`
        ).join(", ")
    const lightGradient = [
        `radial-gradient(circle var(--lr, 0px) at var(--mx) var(--my), ${softStops(lightRGB.a)})`,
        `radial-gradient(circle calc(var(--lr, 0px) * 1.9) at var(--mx) var(--my), ${softStops(lightRGB.a * 0.34)})`,
    ].join(", ")

    const strokePx = Math.max(0, Math.round(strokeWidth))
    const strokeBackdrop = glassy
        ? `saturate(220%) brightness(${STROKE_BRIGHTNESS}%)`
        : "none"

    const strokeBase =
        strokeType === "solid"
            ? strokeColor
            : `linear-gradient(${Math.round(strokeAngle)}deg, ${strokeColorA}, ${strokeColorB})`

    const lightOpaque = rgba(lightRGB, 1)
    const strokeLightGradient = `conic-gradient(from calc((var(--la, 0) - var(--lw, 30)) * 1deg), ${lightClear} 0deg, ${lightOpaque} calc(var(--lw, 30) * 1deg), ${lightClear} calc(var(--lw, 30) * 2deg))`

    const {
        image,
        side: iconSide = "left",
        size: iconSize = 24,
        padding: iconPaddingProp = 0,
        rounded: iconRounded = 0,
    } = icon

    const iconSrc =
        typeof image === "string" ? image : image && image.src ? image.src : ""
    const iconPx = Math.max(0, Math.round(iconSize))

    const iconPadPx = Math.max(0, Math.round(iconPaddingProp))
    const gapPx = Math.max(0, Math.round(gap))

    const iconRadius = radiusFromPercent(iconPx, iconPx, iconRounded)

    const iconEl =
        addIcon && iconSrc && iconPx > 0 ? (
            <img
                src={iconSrc}
                alt=""
                aria-hidden
                draggable={false}
                    style={{
                        width: iconPx,
                        height: iconPx,
                        margin: 0,
                        padding: iconPadPx,
                        boxSizing: "content-box",
                        backgroundColor: iconPadPx > 0 ? "rgba(255,255,255,.15)" : undefined,

                    objectFit: iconRadius > 0 ? "cover" : "contain",
                    borderRadius: Math.min(iconRadius, iconPx / 2),
                    display: "block",
                    flex: "none",
                    pointerEvents: "none",
                }}
            />
        ) : null

    return (
        <div
            ref={scope}
            style={{
                display: "inline-flex",
                minWidth: 80,
                minHeight: 40,
                position: "relative",

                borderRadius: radiusPx,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",

                ["--mx" as any]: "50%",
                ["--my" as any]: "50%",
                ...style,
            }}
        >
            <Tag
                {...tagProps}
                ref={glassRef}
                onPointerMove={trackPointer}
                onPointerEnter={onEnter}
                onPointerLeave={onLeave}
                style={{
                    boxSizing: "border-box",

                    flex: "1 1 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding,
                    border: "none",
                    borderRadius: radiusPx,
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    textDecoration: "none",
                    color: textColor,
                    background: glassBackground,
                    backdropFilter: backdrop,
                    WebkitBackdropFilter: backdrop,

                }}
            >
                {}
                <span
                    ref={lightRef}
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        opacity: 0,
                        pointerEvents: "none",
                        borderRadius: radiusPx,
                        background: lightGradient,
                        mixBlendMode: "screen",
                    }}
                />
                <span
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "inline-flex",
                        alignItems: "center",

                        gap: iconEl && showText ? gapPx : 0,

                        flexDirection:
                            iconSide === "right" ? "row-reverse" : "row",
                    }}
                >
                    {iconEl}
                    {showText && <span style={{ ...font }}>{label}</span>}
                </span>
            </Tag>

            {}
            {strokePx > 0 && (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: -strokePx,
                        borderRadius: radiusPx + strokePx,
                        padding: strokePx,
                        background: strokeBase,
                        backdropFilter: strokeBackdrop,
                        WebkitBackdropFilter: strokeBackdrop,
                        pointerEvents: "none",
                        zIndex: 3,
                        ...RING_MASK,
                    }}
                />
            )}

            {}
            {strokePx > 0 && (
                <span
                    ref={strokeRef}
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: -strokePx,
                        borderRadius: radiusPx + strokePx,
                        padding: strokePx,
                        background: strokeLightGradient,
                        opacity: 0,
                        mixBlendMode: "screen",
                        pointerEvents: "none",
                        zIndex: 4,
                        ["--la" as any]: "0",
                        ["--lw" as any]: "30",
                        ...RING_MASK,
                    }}
                />
            )}
        </div>
    )
}

const __originkitPresetProps = {
  "colors": {
    "fill": "#FFFFFF",
    "textColor": "#FFFFFF"
  },
  "icon": {
    "side": "left",
    "size": 24,
    "image": "",
    "padding": 0,
    "rounded": 0
  },
  "stroke": {
    "type": "gradient",
    "angle": 180,
    "color": "rgba(255, 255, 255, 0.45)",
    "width": 6,
    "colorA": "rgba(255, 255, 255, 0.55)",
    "colorB": "rgba(255, 255, 255, 0.25)"
  },
  "light": {
    "size": 40,
    "color": "rgba(255, 255, 255, 0.45)",
    "intensity": 100,
    "smoothness": 65
  }
};

export default function LiquidGlassButton(props: Record<string, unknown>) {
  return <__OriginkitBase_LiquidGlassButton {...(__originkitPresetProps as Record<string, unknown>)} {...props} />;
}
