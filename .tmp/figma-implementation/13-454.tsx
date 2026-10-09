const assetPathPrefix = "https://www.figma.com/api/mcp/asset/bf5198cd-42ae-480a-b068-27c145d82b0a";
const imgFrame = `${assetPathPrefix}/62fc3.svg`;
const imgFrame1 = `${assetPathPrefix}/239f2.svg`;
const imgFrame2 = `${assetPathPrefix}/18a08.svg`;
const imgFrame3 = `${assetPathPrefix}/b5dc8.svg`;

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

function PusangGalaMascot({ className }: { className?: string }) {
  return (
    <div className={className || "h-[230px] relative w-[220px]"} data-node-id="6:93" data-name="Pusang Gala/Mascot">
      <div className="absolute h-[230px] left-0 top-0 w-[220px]" data-node-id="6:94" data-name="Frame">
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
      </div>
    </div>
  );
}

export default function PrototypeWelcome() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="13:454" data-name="Prototype / welcome">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="13:455" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="13:456" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="13:457" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex flex-col gap-[12px] h-[744px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="13:458" data-name="Screen content">
        <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex h-[235px] items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="13:459" data-name="Mascot hero">
          <PusangGalaMascot className="h-[230px] relative shrink-0 w-[220px]" />
        </div>
        <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[40px] relative shrink-0 text-[34px] text-[color:var(--pg-color-ink,#2e1c14)] text-center w-[350px]" data-node-id="13:461">
          Pusang Gala
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] text-center w-[350px]" data-node-id="13:462" style={{ fontVariationSettings: '"opsz" 14' }}>
          Your offline commute buddy
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] text-center w-[350px]" data-node-id="13:463" style={{ fontVariationSettings: '"opsz" 14' }}>
          Find your daanan, kahit walang internet.
        </p>
        <div className="content-stretch flex gap-[14px] h-[70px] items-center relative shrink-0 w-[350px]" data-node-id="13:464" data-name="Pusang Gala/Feature row">
          <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 size-[48px]" data-node-id="I13:464;6:75" data-name="Icon tile">
            <div className="relative shrink-0 size-[24px]" data-node-id="I13:464;6:76" data-name="Pusang Gala/Icon/map">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I13:464;6:76;6:15" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
              </div>
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[280px]" data-node-id="I13:464;6:80" data-name="Text">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[280px]" data-node-id="I13:464;6:81" style={{ fontVariationSettings: '"opsz" 14' }}>
              Offline maps
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[280px]" data-node-id="I13:464;6:82" style={{ fontVariationSettings: '"opsz" 14' }}>
              Download your corridor before you go.
            </p>
          </div>
        </div>
        <div className="content-stretch flex gap-[14px] h-[70px] items-center relative shrink-0 w-[350px]" data-node-id="13:465" data-name="Pusang Gala/Feature row">
          <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 size-[48px]" data-node-id="I13:465;6:75" data-name="Icon tile">
            <div className="relative shrink-0 size-[24px]" data-node-id="I13:465;6:76" data-name="Pusang Gala/Icon/bus">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I13:465;6:76;6:19" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
              </div>
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[280px]" data-node-id="I13:465;6:80" data-name="Text">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[280px]" data-node-id="I13:465;6:81" style={{ fontVariationSettings: '"opsz" 14' }}>
              Verified routes
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[280px]" data-node-id="I13:465;6:82" style={{ fontVariationSettings: '"opsz" 14' }}>
              Signboards, landmarks, and fare estimates.
            </p>
          </div>
        </div>
        <div className="content-stretch flex gap-[14px] h-[70px] items-center relative shrink-0 w-[350px]" data-node-id="13:466" data-name="Pusang Gala/Feature row">
          <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 size-[48px]" data-node-id="I13:466;6:75" data-name="Icon tile">
            <div className="relative shrink-0 size-[24px]" data-node-id="I13:466;6:76" data-name="Pusang Gala/Icon/spark">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I13:466;6:76;6:29" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
              </div>
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[280px]" data-node-id="I13:466;6:80" data-name="Text">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[280px]" data-node-id="I13:466;6:81" style={{ fontVariationSettings: '"opsz" 14' }}>
              AI Taglish search
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[280px]" data-node-id="I13:466;6:82" style={{ fontVariationSettings: '"opsz" 14' }}>
              Ask like you would ask a friend.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="13:467" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="Get started →" />
      </div>
    </div>
  );
}
