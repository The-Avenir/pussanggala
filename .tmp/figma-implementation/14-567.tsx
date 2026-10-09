const assetPathPrefix = "https://www.figma.com/api/mcp/asset/c9c6dc11-9713-4a38-b3b2-4d786d944f7b";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/e6da9.svg`;
const imgFrame3 = `${assetPathPrefix}/2ffb3.svg`;
const imgFrame4 = `${assetPathPrefix}/d8c58.svg`;
const imgFrame5 = `${assetPathPrefix}/e681d.svg`;

type PusangGalaButtonProps = {
  className?: string;
  kind?: "Primary";
  label?: string;
};

function PusangGalaButton({ className, kind = "Primary", label = "Continue →" }: PusangGalaButtonProps) {
  return (
    <div className={className || "bg-[var(--pg-color-orange,#f34b16)] content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] w-[350px]"} data-node-id="6:6">
      <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-white,white)] whitespace-nowrap" data-node-id="6:7" style={{ fontVariationSettings: '"opsz" 14' }}>
        {label}
      </p>
    </div>
  );
}

export default function PrototypeOptions() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:567" data-name="Prototype / options">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:568" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:569" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:570" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:571" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:572" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:572;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:573">
          Route options
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:574" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:574;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:575" data-name="Screen content">
        <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:576" data-name="Cubao → Masinag">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:577" data-name="Pusang Gala/Icon/pin">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:577;6:25" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-orange,#f34b16)] whitespace-nowrap" data-node-id="14:578" style={{ fontVariationSettings: '"opsz" 14' }}>
            Cubao → Masinag
          </p>
        </div>
        <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] w-[350px]" data-node-id="14:579">
          Your trip, your way.
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:580" style={{ fontVariationSettings: '"opsz" 14' }}>
          Choose what matters most today.
        </p>
        <a className="bg-[var(--pg-color-orangeSoft,#fff0dd)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch cursor-pointer flex flex-col gap-[8px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:581" data-name="Cheapest">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[309px]" data-node-id="14:582" data-name="Option heading">
            <div className="relative shrink-0 size-[24px]" data-node-id="14:583" data-name="Pusang Gala/Icon/bus">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:583;6:19" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] text-left w-[244px]" data-node-id="14:584">
              Cheapest
            </p>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-orange,#f34b16)] text-left whitespace-nowrap" data-node-id="14:585">
              ●
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="14:586">
            ₱25–35
          </p>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] text-left w-[318px]" data-node-id="14:587" style={{ fontVariationSettings: '"opsz" 14' }}>
            35–45 min · 0 transfers
          </p>
        </a>
        <a className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch cursor-pointer flex flex-col gap-[8px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:588" data-name="Fastest">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[309px]" data-node-id="14:589" data-name="Option heading">
            <div className="relative shrink-0 size-[24px]" data-node-id="14:590" data-name="Pusang Gala/Icon/bolt">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:590;6:52" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] text-left w-[244px]" data-node-id="14:591">
              Fastest
            </p>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-muted,#7c6c60)] text-left whitespace-nowrap" data-node-id="14:592">
              ○
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="14:593">
            ₱30–40
          </p>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] text-left w-[318px]" data-node-id="14:594" style={{ fontVariationSettings: '"opsz" 14' }}>
            30–40 min · 1 transfer
          </p>
        </a>
        <a className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch cursor-pointer flex flex-col gap-[8px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:595" data-name="Fewest transfers">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[309px]" data-node-id="14:596" data-name="Option heading">
            <div className="relative shrink-0 size-[24px]" data-node-id="14:597" data-name="Pusang Gala/Icon/pin">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:597;6:25" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame5} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] text-left w-[244px]" data-node-id="14:598">
              Fewest transfers
            </p>
            <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-muted,#7c6c60)] text-left whitespace-nowrap" data-node-id="14:599">
              ○
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="14:600">
            ₱25–35
          </p>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] text-left w-[318px]" data-node-id="14:601" style={{ fontVariationSettings: '"opsz" 14' }}>
            35–45 min · 0 transfers
          </p>
        </a>
        <div className="bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col items-start overflow-clip p-[12px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:602" data-name="Estimates note">
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[326px]" data-node-id="14:603" style={{ fontVariationSettings: '"opsz" 14' }}>
            Fares and times are estimates. Check the signboard and ask the driver before boarding.
          </p>
        </div>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:604" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="See directions →" />
      </div>
    </div>
  );
}
