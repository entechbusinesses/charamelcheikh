import { StepBack } from "lucide-react";
import { Input } from "../ui/input";

const NumPad = ({
  total,
  setTotal,
}: {
  total: number | string;
  setTotal: (e: number | string) => void;
}) => {
  return (
    <>
      <section className=" border-r p-5 gap-2 rounded-lg grid grid-cols-3 text-2xl bg-gray-200 flex-grow pr-5">
        <Input
          value={total}
          onChange={(e) => setTotal(+e.target.value)}
          className={`w-full border col-span-3 text-lg`}
        />

        {[{}, {}, {}, {}, {}, {}, {}, {}, {}].map((_, id) => (
          <button
            className="bg-blue-500 h-14 text-white rounded-lg"
            onClick={() =>
              setTotal(
                String(total)[0] == "0" ? `${id + 1}` : `${total}${id + 1}`
              )
            }
          >
            {id + 1}
          </button>
        ))}
        <button
          className="bg-blue-500 h-14 text-white rounded-lg"
          onClick={() => setTotal(`${total}0`)}
        >
          0
        </button>
        <button
          className="bg-red-500 flex h-14 items-center rounded-lg justify-center text-white col-span-2"
          onClick={() => setTotal(0)}
        >
          <StepBack className="size-10" />
        </button>
      </section>
    </>
  );
};

export default NumPad;
