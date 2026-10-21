import React, { forwardRef, useState, useEffect } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  error?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = "text",
      className = "",
      error,
      placeholder,
      required = false,
      ...props
    },
    ref
  ) => {
    const id =
      props.id ||
      props.name ||
      `input-${Math.random().toString(36).substr(2, 9)}`;

    // State for managing focus and input value
    const [focused, setFocused] = useState(false);
    const [hasValue, setHasValue] = useState(
      !!props.value || props.value === 0
    );

    // Handle focus and blur events
    const handleFocus = () => setFocused(true);
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      setHasValue(e.target.value.length > 0); // Update hasValue on blur
    };

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0); // Update hasValue on change
    };

    useEffect(() => {
      if (type === "number") {
        setHasValue(true);
      } else {
        setHasValue(!!props.value);
      }
    }, [props.value]);

    return (
      <div className={`${className} relative`}>
        {placeholder && (
          <span
            className={`absolute left-3 rtl:right-3 w-max rounded-md z-10 top-1/2 select-none pointer-events-none transform -translate-y-1/2 ml-2 transition-all duration-200 ease-in-out ${
              focused || hasValue
                ? `text-sm top-[0px] bg-white dark:bg-dark px-1 ${
                    focused ? "text-main" : "text-black dark:text-white"
                  }`
                : "text-base  text-gray-400"
            }`}
          >
            {placeholder}
            {/* <span
              className={cn("", required && "text-red-500 font-bold text-base")}
            >
              {required ? "*" : t(" (optionnel)")}
            </span> */}
          </span>
        )}

        {/* Input field */}
        <input
          ref={ref}
          id={id}
          type={type}
          className={`w-full rounded-lg border-[1.5px] bg-transparent py-3 px-5 text-black dark:text-white outline-none transition focus:border-main active:border-primary disabled:cursor-not-allowed disabled:bg-gray-100 ${
            error ? "border-red-500" : ""
          }`}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

// import { cn } from "@/lib/utils";
// import { t } from "i18next";
// import React, { forwardRef, useState, useEffect } from "react";
// import { VirtualKeyboard } from "./Keyboard";

// interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
//   className?: string;
//   error?: string;
//   required?: boolean;
//   value?: string | number;
//   onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
// }

// const Input = forwardRef<HTMLInputElement, InputProps>(
//   (
//     {
//       type = "text",
//       className = "",
//       error,
//       placeholder,
//       required = false,
//       value,
//       onChange,
//       ...props
//     },
//     ref
//   ) => {
//     const id =
//       props.id ||
//       props.name ||
//       `input-${Math.random().toString(36).substr(2, 9)}`;
//     const [focused, setFocused] = useState(false);
//     const [showKeyboard, setShowKeyboard] = useState(false);
//     const [localValue, setLocalValue] = useState(value?.toString() ?? "");
//     const inputRef =
//       (ref as React.RefObject<HTMLInputElement>) ||
//       React.createRef<HTMLInputElement>();

//     useEffect(() => {
//       setLocalValue(value?.toString() ?? "");
//     }, [value]);

//     const handleInputChange = (newValue: string) => {
//       setLocalValue(newValue);
//       if (onChange) {
//         const syntheticEvent = {
//           target: { value: newValue },
//           currentTarget: { value: newValue },
//         } as React.ChangeEvent<HTMLInputElement>;
//         onChange(syntheticEvent);
//       }
//     };

//     const handleFocus = () => {
//       setFocused(true);
//       setShowKeyboard(true);
//       document.body.style.paddingBottom = "280px";
//       requestAnimationFrame(() => {
//         inputRef.current?.scrollIntoView({
//           behavior: "smooth",
//           block: "center",
//         });
//       });
//     };

//     const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
//       if (!e.relatedTarget?.closest(".virtual-keyboard")) {
//         setFocused(false);
//       }
//     };

//     const handleKeyPress = (key: string) => {
//       handleInputChange(localValue + key);
//     };

//     const handleBackspace = () => {
//       handleInputChange(localValue.slice(0, -1));
//     };

//     const handleEnter = () => {
//       setShowKeyboard(false);
//       document.body.style.paddingBottom = "0";
//       inputRef.current?.blur();
//     };

//     useEffect(() => {
//       return () => {
//         document.body.style.paddingBottom = "0";
//       };
//     }, []);

//     useEffect(() => {
//       if (!focused) {
//       }
//     }, [focused]);

//     return (
//       <div className="relative">
//         <div className={cn("relative", className)}>
//           {placeholder && (
//             <span
//               className={`absolute left-3 rtl:right-3 w-max rounded-md z-10 top-1/2 select-none pointer-events-none transform -translate-y-1/2 ml-2 transition-all duration-200 ease-in-out ${
//                 focused || localValue
//                   ? `text-sm top-[0px] bg-white dark:bg-dark px-1 ${
//                       focused ? "text-main" : "text-black dark:text-white"
//                     }`
//                   : "text-base  text-gray-400"
//               }`}
//             >
//               {placeholder}
//               <span
//                 className={cn(
//                   "ml-1",
//                   required && "text-destructive font-medium"
//                 )}
//               >
//                 {required ? "*" : t("optional")}
//               </span>
//             </span>
//           )}

//           <input
//             ref={inputRef}
//             id={id}
//             type={type}
//             className={cn(
//               "w-full rounded-lg border bg-transparent py-3 px-5 text-foreground outline-none transition",
//               "focus:border-primary active:border-primary",
//               "disabled:cursor-not-allowed disabled:opacity-50",
//               error && "border-destructive",
//               "border-input"
//             )}
//             onFocus={handleFocus}
//             onBlur={handleBlur}
//             onChange={(e) => handleInputChange(e.target.value)}
//             value={localValue}
//             {...props}
//           />
//         </div>

//         {showKeyboard && (
//           <VirtualKeyboard
//             onKeyPress={handleKeyPress}
//             onBackspace={handleBackspace}
//             onEnter={handleEnter}
//           />
//         )}
//       </div>
//     );
//   }
// );

// Input.displayName = "Input";

// export default Input;
