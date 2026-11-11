import React from 'react'
import { motion } from 'framer-motion'

export default function Button({
  children, variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight,
  className = '', as = 'button', ...props
}) {
  const Comp = motion[as] || motion.button
  const classes = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'accent' && 'btn-accent',
    variant === 'ghost' && 'btn-ghost',
    variant === 'light' && 'btn-light',
    size === 'sm' && 'btn-sm',
    props.block && 'btn-block',
    className
  ].filter(Boolean).join(' ')

  return (
    <Comp whileTap={{ scale: 0.96 }} className={classes} {...props}>
      {Icon && <Icon size={size === 'sm' ? 15 : 18} />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 15 : 18} />}
    </Comp>
  )
}
