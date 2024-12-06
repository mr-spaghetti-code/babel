const form = document.querySelector("form#browse");
const button = document.querySelector("form#browse button");

form.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const identifier = [
    formData.get("room"),
    formData.get("wall"),
    formData.get("shelf"),
    formData.get("book"),
    formData.get("page"),
  ].join(".");

  button.disabled = true;
  button.innerText = "Loading...";

  const res = await fetch("/get-uid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier }),
  });

  button.disabled = false;
  button.innerText = "Go";

  if (res.ok) {
    const ref = await res.text();
    location.href = `/ref/${ref}`;
  }
};

const room = form.querySelector('[name="room"]');
room.oninput = (e) => {
  if (
    (!e.data || !/[0-9a-v]/.test(e.data)) &&
    e.inputType !== "deleteContentBackward" &&
    e.inputType !== "deleteContentForward"
  ) {
    e.target.value = e.target.value.slice(0, -1);
  }
};

const constrainInput = (e) => {
  if (e.target.value === "") return;
  const min = parseInt(e.target.min);
  const max = parseInt(e.target.max);
  if (e.target.value < min) e.target.value = min;
  if (e.target.value > max) e.target.value = max;
};

const wall = form.querySelector('[name="wall"]');
wall.oninput = constrainInput;

const shelf = form.querySelector('[name="shelf"]');
shelf.oninput = constrainInput;

const book = form.querySelector('[name="book"]');
book.oninput = constrainInput;

const page = form.querySelector('[name="page"]');
page.oninput = constrainInput;
