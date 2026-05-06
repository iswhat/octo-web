import React, { useRef, useState, useEffect, useCallback } from "react";
import { Tooltip } from "@douyinfe/semi-ui";

interface OverflowTooltipProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    as?: React.ElementType;
}

const OverflowTooltip: React.FC<OverflowTooltipProps> = ({ children, className, style, as: Component = "div" }) => {
    const containerRef = useRef<HTMLElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [visible, setVisible] = useState(false);

    const checkOverflow = useCallback(() => {
        const el = containerRef.current;
        if (el) {
            setIsOverflowing(el.scrollWidth > el.clientWidth);
        }
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);
        observer.observe(el);
        return () => observer.disconnect();
    }, [checkOverflow]);

    const onMouseEnter = useCallback(() => {
        if (containerRef.current && containerRef.current.scrollWidth > containerRef.current.clientWidth) {
            setVisible(true);
        }
    }, []);

    const onMouseLeave = useCallback(() => setVisible(false), []);

    return (
        <Tooltip
            content={containerRef.current?.textContent ?? ""}
            position="bottom"
            trigger="custom"
            visible={visible}
        >
            <Component
                ref={containerRef}
                className={className}
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {children}
            </Component>
        </Tooltip>
    );
};

export default OverflowTooltip;
