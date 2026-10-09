const assetPathPrefix = "https://www.figma.com/api/mcp/asset/e63d1f83-1386-4e64-bec5-c83bdd40ef9a";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/e6da9.svg`;
const imgFrame3 = `${assetPathPrefix}/7a422.svg`;
const imgFrame4 = `${assetPathPrefix}/fb95a.svg`;

type PusangGalaButtonProps = {
  className?: string;
  kind?: "Primary" | "Secondary";
  label?: string;
};

function PusangGalaButton({ className, kind = "Primary", label = "Continue →" }: PusangGalaButtonProps) {
  const isSecondary = kind === "Secondary";
  return (
    <div className={className || `content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] w-[350px] ${isSecondary ? "bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid" : "bg-[var(--pg-color-orange,#f34b16)]"}`} id={isSecondary ? "node-6_8" : "node-6_6"}>
      {kind === "Primary" && (
        <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-white,white)] whitespace-nowrap" data-node-id="6:7" style={{ fontVariationSettings: '"opsz" 14' }}>
          {label}
        </p>
      )}
      {isSecondary && (
        <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="6:9" style={{ fontVariationSettings: '"opsz" 14' }}>
          {label}
        </p>
      )}
    </div>
  );
}

export default function PrototypeDirections() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:625" data-name="Prototype / directions">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:626" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:627" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:628" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:629" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:630" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:630;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:631">
          Step 1 of 4
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:632" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:632;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:633" data-name="Screen content">
        <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:634" data-name="Cubao → Masinag">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:635" data-name="Pusang Gala/Icon/pin">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:635;6:25" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-orange,#f34b16)] whitespace-nowrap" data-node-id="14:636" style={{ fontVariationSettings: '"opsz" 14' }}>
            Cubao → Masinag
          </p>
        </div>
        <div className="h-[180px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:637" data-name="Pusang Gala/Corridor illustration">
          <div className="absolute h-[180px] left-0 top-0 w-[350px]" data-node-id="I14:637;6:122" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
          </div>
        </div>
        <div className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:638" data-name="Boarding instructions">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[316px]" data-node-id="14:639" data-name="Walk to the Cubao boarding point">
            <div className="relative shrink-0 size-[22px]" data-node-id="14:640" data-name="Pusang Gala/Icon/walk">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:640;6:48" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
              </div>
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip relative shrink-0 w-[282px]" data-node-id="14:641" data-name="Step facts">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[282px]" data-node-id="14:642" style={{ fontVariationSettings: '"opsz" 14' }}>
                Walk to the Cubao boarding point
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[282px]" data-node-id="14:643" style={{ fontVariationSettings: '"opsz" 14' }}>
                About 5 min · 400 m
              </p>
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[318px]" data-node-id="14:644" style={{ fontVariationSettings: '"opsz" 14' }}>
            From Araneta Center, follow the verified walking link to the terminal.
          </p>
        </div>
        <div className="[word-break:break-word] bg-[var(--pg-color-blueSoft,#eaf2ff)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[8px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:645" data-name="Signboard">
          <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-blue,#166dfa)] w-[318px]" data-node-id="14:646" style={{ fontVariationSettings: '"opsz" 14' }}>
            LOOK FOR THIS SIGNBOARD
          </p>
          <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[318px]" data-node-id="14:647">
            ANTIPOLO / MASINAG
          </p>
          <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[318px]" data-node-id="14:648" style={{ fontVariationSettings: '"opsz" 14' }}>
            Confirm that the jeep passes your alighting stop before you board.
          </p>
        </div>
        <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:649" style={{ fontVariationSettings: '"opsz" 14' }}>
          Local tip
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[350px]" data-node-id="14:650" style={{ fontVariationSettings: '"opsz" 14' }}>
          “Kuya, dadaan po ba sa Masinag?”
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:651" style={{ fontVariationSettings: '"opsz" 14' }}>
          Route notes · last checked in the corridor pack
        </p>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch cursor-pointer flex gap-[12px] h-[70px] items-start overflow-clip pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:652" data-name="Step navigation">
        <PusangGalaButton className="bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[160px]" kind="Secondary" label="← Previous" />
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[178px]" label="Start trip →" />
      </div>
    </div>
  );
}
